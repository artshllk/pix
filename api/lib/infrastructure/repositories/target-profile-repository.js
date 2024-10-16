import { knex } from '../../../db/knex-database-connection.js';
import { Badge } from '../../../src/evaluation/domain/models/Badge.js';
import { NotFoundError } from '../../../src/shared/domain/errors.js';
import { ObjectValidationError } from '../../../src/shared/domain/errors.js';
import { TargetProfile } from '../../../src/shared/domain/models/index.js';
import { DomainTransaction } from '../DomainTransaction.js';

const TARGET_PROFILE_TABLE = 'target-profiles';

const get = async function (id) {
  const knexConn = DomainTransaction.getConnection();
  const targetProfile = await knexConn('target-profiles').where({ id }).first();
  const badges = await knexConn('badges').where('targetProfileId', id);

  if (!targetProfile) {
    throw new NotFoundError(`Le profil cible avec l'id ${id} n'existe pas`);
  }

  return new TargetProfile({ ...targetProfile, badges: badges.map((badge) => new Badge(badge)) });
};

const findByIds = async function (targetProfileIds) {
  const targetProfiles = await knex('target-profiles').whereIn('id', targetProfileIds);
  return targetProfiles.map((targetProfile) => {
    return new TargetProfile(targetProfile);
  });
};

const findOrganizationIds = async function (targetProfileId) {
  const targetProfile = await knex(TARGET_PROFILE_TABLE).select('id').where({ id: targetProfileId }).first();
  if (!targetProfile) {
    throw new NotFoundError(`No target profile for ID ${targetProfileId}`);
  }

  const targetProfileShares = await knex('target-profile-shares')
    .select('organizationId')
    .where({ 'target-profile-shares.targetProfileId': targetProfileId });
  return targetProfileShares.map((targetProfileShare) => targetProfileShare.organizationId);
};

const hasTubesWithLevels = async function ({ targetProfileId, tubesWithLevels }) {
  const knexConn = DomainTransaction.getConnection();
  const tubeIds = tubesWithLevels.map(({ id }) => id);

  const result = await knexConn('target-profile_tubes')
    .whereIn('tubeId', tubeIds)
    .andWhere('targetProfileId', targetProfileId);

  for (const tubeWithLevel of tubesWithLevels) {
    const targetProfileTube = result.find(({ tubeId }) => tubeId === tubeWithLevel.id);
    if (!targetProfileTube) {
      throw new ObjectValidationError(`Le sujet ${tubeWithLevel.id} ne fait pas partie du profil cible`);
    }

    if (tubeWithLevel.level > targetProfileTube.level) {
      throw new ObjectValidationError(
        `Le niveau ${tubeWithLevel.level} dépasse le niveau max du sujet ${tubeWithLevel.id}`,
      );
    }
  }
};

export { findByIds, findOrganizationIds, get, hasTubesWithLevels };
