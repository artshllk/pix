import 'dotenv/config';

import * as url from 'node:url';

import lodash from 'lodash';

import { disconnect, knex } from '../../../db/knex-database-connection.js';
import { CERTIFICATION_FEATURES } from '../../../src/certification/shared/domain/constants.js';
import { logger } from '../../../src/shared/infrastructure/utils/logger.js';
/**
 * Usage: node scripts/certification/next-gen/import-complementary-alone-feature-pilot-certification-centers-from-csv.js path/file.csv
 * File is semicolon separated values, headers being:
 * certification_center_id
 **/
import { checkCsvHeader, parseCsv } from '../../helpers/csvHelpers.js';

const { values } = lodash;

const headers = {
  certificationCenterId: 'certification_center_id',
};

async function extractCsvData(filePath) {
  const dataRows = await parseCsv(filePath, { header: true, delimiter: ';', skipEmptyLines: true });
  return dataRows.reduce((certificationCentersIds, dataRow) => {
    const certificationCenterId = parseInt(dataRow[headers.certificationCenterId]);
    certificationCentersIds.push(certificationCenterId);
    return certificationCentersIds;
  }, []);
}

function buildCertificationCentersPilotsList({ featureId, certificationCentersIds }) {
  return certificationCentersIds.map((certificationCenterId) => {
    return {
      certificationCenterId,
      featureId,
    };
  });
}

async function allowOnlyV3CertificationCenters({ certificationCentersIds }) {
  const v2CertificationIdsFound = await knex
    .select('id')
    .from('certification-centers')
    .whereIn('id', certificationCentersIds)
    .andWhereNot({ isV3Pilot: true })
    .pluck('id');

  if (v2CertificationIdsFound.length > 0) {
    throw new Error(`V2 certification centers : ${v2CertificationIdsFound} are not allowed as pilots`);
  }
}

function _getInsertedLineNumber(batchInfo) {
  return batchInfo.map(({ rowCount }) => rowCount).reduce((acc, count) => acc + count, 0);
}

const modulePath = url.fileURLToPath(import.meta.url);
const isLaunchedFromCommandLine = process.argv[1] === modulePath;

async function main(filePath) {
  logger.info('Starting script import-pilot-certification-centers-from-csv');

  let trx;
  try {
    logger.info(`Checking ${filePath} data file...`);
    await checkCsvHeader({ filePath, requiredFieldNames: values(headers) });
    logger.info('✅ ');

    logger.info('Reading and parsing csv data file... ');
    const certificationCentersIds = await extractCsvData(filePath);
    logger.info('✅ ');

    logger.info('Veryfing certification centers eligibility as pilots... ');
    await allowOnlyV3CertificationCenters({ certificationCentersIds });
    logger.info('✅ ');

    const featureId = await knex
      .select('id')
      .from('features')
      .where({ key: CERTIFICATION_FEATURES.CAN_REGISTER_FOR_A_COMPLEMENTARY_CERTIFICATION_ALONE.key })
      .first()
      .then((row) => row.id);

    logger.info('Retrieving certification center pilots... ');
    const certificationCentersPilotsList = buildCertificationCentersPilotsList({ featureId, certificationCentersIds });
    logger.info('✅ ');

    logger.info('Inserting pilot certification center ids in database... ');
    trx = await knex.transaction();
    await trx('certification-center-features')
      .leftJoin('features', 'features.id', 'certification-center-features.featureId')
      .where('features.key', CERTIFICATION_FEATURES.CAN_REGISTER_FOR_A_COMPLEMENTARY_CERTIFICATION_ALONE.key)
      .del();
    const batchInfo = await trx.batchInsert('certification-center-features', certificationCentersPilotsList);
    const insertedLines = _getInsertedLineNumber(batchInfo);
    logger.info('✅ ');
    await trx.commit();
    logger.info(`Added lines: ${insertedLines}`);
    logger.info('Done.');
  } catch (error) {
    if (trx) {
      await trx.rollback();
    }
    throw error;
  }
}

(async () => {
  if (isLaunchedFromCommandLine) {
    try {
      const filePath = process.argv[2];
      await main(filePath);
    } catch (error) {
      logger.error(error);
      process.exitCode = 1;
    } finally {
      await disconnect();
    }
  }
})();

export { main };
