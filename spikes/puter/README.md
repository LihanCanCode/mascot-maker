# Puter.js image spike (developer experiment, not in the build)
1. Open http://127.0.0.1:5173/spikes/puter/index.html (the running `pnpm dev` server; any http origin works, file:// does not).
2. Regenerate prompts only if src/prompts changed: `node spikes/puter/dump-prompts.mjs` (writes prompts.json, key colour green).
3. Click "Sign in with Puter" (popup, your own account). Never paste tokens anywhere.
4. Tick "Test mode" first to confirm the wiring; it returns a sample image and costs nothing.
5. Untick it, open the dashboard usage link (https://puter.com/dashboard#usage) and note the balance, or press "Refresh monthly usage here".
6. Run Step 1, then Step 2 (it feeds the Step 1 image back as input_images). Re-check usage: the difference is the cost per image.
7. Repeat per model and quality tier; keep going until the log shows 402 insufficient_funds to find the end of the free allowance.
8. "Download both", drop the two files into the main app's upload step at http://127.0.0.1:5173/ and see what the real checker says.
9. Paste back to the lead: the log, usage before/after one pair, quality verdict vs the Gemini app, checker results.
10. Free accounts get 3 concurrent AI requests and 30 per 10 s, so run one sheet at a time.
