import type { ChatGuide } from '../core/types'

const STEPS: readonly string[] = [
  'Open a new chat.',
  'If you use the photo route, attach your photo.',
  'Paste message 1 and wait for the image.',
  'Download the image at full size; do not screenshot it.',
  'Send message 2 in the same chat with that image attached again.',
  'Download that image too.',
]

const TIPS: readonly string[] = [
  'If you see a grey-and-white checkerboard, start a NEW chat and paste the message again without adding any words.',
  'Do not retry inside the same chat; the model averages its earlier attempts and the two sheets stop matching.',
  'Free plans may limit how many images you can make, so check before you start.',
  'Images downloaded from a chat often come back as JPEG files. That is fine; upload them as they are.',
  'If the reactions heads are still turned, start a NEW chat, attach the directions image and paste message 2 again. Do not retry inside the same chat.',
  'Last resort only, in the SAME chat: send "Redo the sheet: every one of the nine heads must face straight at me, only the expressions differ."',
  'Your photo goes to that provider under their terms, never to us.',
]

export const CHAT_GUIDES: readonly ChatGuide[] = [
  { id: 'gemini', name: 'Gemini', steps: STEPS, tips: TIPS },
  { id: 'chatgpt', name: 'ChatGPT', steps: STEPS, tips: TIPS },
]
