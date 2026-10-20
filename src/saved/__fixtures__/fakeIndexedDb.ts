/**
 * A small stand-in for IndexedDB, enough to drive `indexedDbStore` in Node: upgrades,
 * read and write transactions, commit ordering, and a storage limit that aborts a write
 * with a QuotaExceededError the way a real browser does.
 */
type Row = { id: string } & Record<string, unknown>

type Handler = (() => void) | null

class FakeRequest<T> {
  result!: T
  error: { name: string; message: string } | null = null
  onsuccess: Handler = null
  onerror: Handler = null
}

function sizeOf(row: Row): number {
  let bytes = 0
  for (const value of Object.values(row)) {
    if (value instanceof Blob) bytes += value.size
    else bytes += JSON.stringify(value ?? null).length
  }
  return bytes
}

export interface FakeOptions {
  /** Abort a write once the whole database would pass this many bytes. */
  readonly quotaBytes?: number
  /** Reject `open` with an error of this name, the way a locked-down browser does. */
  readonly openFails?: string
  /** Throw synchronously from `open`, the way some private windows do. */
  readonly openThrows?: boolean
}

class FakeObjectStore {
  constructor(
    private readonly rows: Map<string, Row>,
    private readonly tx: FakeTransaction,
  ) {}

  private request<T>(run: () => T): FakeRequest<T> {
    const request = new FakeRequest<T>()
    this.tx.enqueue(() => {
      request.result = run()
      request.onsuccess?.()
    }, request)
    return request
  }

  get(id: string): FakeRequest<Row | undefined> {
    return this.request(() => this.rows.get(id))
  }
  getAll(): FakeRequest<Row[]> {
    return this.request(() => [...this.rows.values()])
  }
  put(row: Row): FakeRequest<string> {
    return this.request(() => {
      this.tx.chargeFor(row)
      this.rows.set(row.id, row)
      return row.id
    })
  }
  delete(id: string): FakeRequest<undefined> {
    return this.request(() => {
      this.rows.delete(id)
      return undefined
    })
  }
  clear(): FakeRequest<undefined> {
    return this.request(() => {
      this.rows.clear()
      return undefined
    })
  }
}

class FakeTransaction {
  error: { name: string; message: string } | null = null
  oncomplete: Handler = null
  onabort: Handler = null
  onerror: Handler = null
  private pending = 0
  private dead = false

  constructor(
    private readonly db: FakeDatabase,
    private readonly names: readonly string[],
  ) {}

  objectStore(name: string): FakeObjectStore {
    if (!this.names.includes(name)) throw new Error(`Transaction does not cover "${name}".`)
    return new FakeObjectStore(this.db.rowsFor(name), this)
  }

  chargeFor(row: Row): void {
    const limit = this.db.options.quotaBytes
    if (limit !== undefined && this.db.totalBytes() + sizeOf(row) > limit) {
      const error = { name: 'QuotaExceededError', message: 'The quota has been exceeded.' }
      throw error
    }
  }

  enqueue(run: () => void, request: FakeRequest<unknown>): void {
    this.pending += 1
    queueMicrotask(() => {
      if (this.dead) return
      try {
        run()
      } catch (thrown: unknown) {
        request.error = thrown as { name: string; message: string }
        this.error = request.error
        this.dead = true
        request.onerror?.()
        this.onabort?.()
        return
      }
      this.pending -= 1
      if (this.pending === 0) queueMicrotask(() => this.finish())
    })
  }

  private finish(): void {
    if (this.dead || this.pending > 0) return
    this.dead = true
    this.oncomplete?.()
  }
}

class FakeDatabase {
  readonly stores = new Map<string, Map<string, Row>>()
  constructor(readonly options: FakeOptions) {}

  get objectStoreNames(): { contains: (name: string) => boolean } {
    return { contains: (name: string) => this.stores.has(name) }
  }
  createObjectStore(name: string): void {
    this.stores.set(name, new Map())
  }
  rowsFor(name: string): Map<string, Row> {
    const rows = this.stores.get(name)
    if (rows === undefined) throw new Error(`No object store "${name}".`)
    return rows
  }
  totalBytes(): number {
    let bytes = 0
    for (const rows of this.stores.values()) for (const row of rows.values()) bytes += sizeOf(row)
    return bytes
  }
  transaction(names: readonly string[]): FakeTransaction {
    return new FakeTransaction(this, names)
  }
}

/** A factory to pass to `indexedDbStore`. Data lives for as long as the factory does. */
export function fakeIndexedDb(options: FakeOptions = {}): IDBFactory {
  let db: FakeDatabase | null = null
  const factory = {
    open(_name: string, _version: number) {
      if (options.openThrows === true) throw new Error('Access to storage is not allowed from this context.')
      const request = new FakeRequest<FakeDatabase>()
      const target = request as FakeRequest<FakeDatabase> & { onupgradeneeded: Handler; onblocked: Handler }
      queueMicrotask(() => {
        if (options.openFails !== undefined) {
          request.error = { name: options.openFails, message: 'The database could not be opened.' }
          request.onerror?.()
          return
        }
        const fresh = db === null
        db ??= new FakeDatabase(options)
        request.result = db
        if (fresh) target.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return target
    },
  }
  Object.assign(factory, { __db: (): FakeDatabase | null => db })
  return factory as unknown as IDBFactory
}

/** Reach into a fake factory's rows, so a test can plant a record from a future version. */
export function fakeRows(factory: IDBFactory, store: string): Map<string, Row> | null {
  const held = (factory as unknown as { __db: () => FakeDatabase | null }).__db()
  return held === null ? null : (held.stores.get(store) ?? null)
}
