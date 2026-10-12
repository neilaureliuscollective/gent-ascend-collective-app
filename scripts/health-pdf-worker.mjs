// No rendering, JavaScript actions, network sources or user-provided code execution.
import { parentPort } from 'node:worker_threads';
import { PDFDocument } from 'pdf-lib';
parentPort.once('message', async (bytes) => {
  try {
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 8388608)
      throw new Error();
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    if (document.getPageCount() > 40) throw new Error();
    const form = document.getForm();
    let text = null;
    try {
      if (form.getTextField('aethelios_lab_exchange_version').getText() === '1')
        text = form.getTextField('aethelios_lab_exchange_json').getText() ?? '';
    } catch {
      /* Ordinary PDF: original retained, extraction unsupported. */
    }
    if (text !== null && text.length > 200000) throw new Error();
    parentPort.postMessage({ text });
  } catch {
    parentPort.postMessage({ failed: true });
  }
});
