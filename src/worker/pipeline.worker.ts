import type { WorkerRequest, WorkerResponse } from './protocol'
import { handleRequest } from './runJob'

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage(message: WorkerResponse, transfer?: ArrayBuffer[]): void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (event) => {
  if (event.data.type !== 'run') return
  void handleRequest(event.data, (response, transfer) => scope.postMessage(response, transfer))
}
