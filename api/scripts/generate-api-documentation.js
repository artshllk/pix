import 'dotenv/config';

import * as url from 'node:url';

import jsdocToMarkdown from 'jsdoc-to-markdown';

import { logger } from '../src/shared/infrastructure/utils/logger.js';

async function main(baseFolder) {
  const docs = await jsdocToMarkdown.render({ files: `${baseFolder}/**/application/api/**/*.js` });

  console.log(docs);
}

const modulePath = url.fileURLToPath(import.meta.url);
const isLaunchedFromCommandLine = process.argv[1] === modulePath;

(async () => {
  if (isLaunchedFromCommandLine) {
    try {
      await main(process.argv[2]);
    } catch (error) {
      logger.error(error);
      process.exitCode = 1;
    }
  }
})();
