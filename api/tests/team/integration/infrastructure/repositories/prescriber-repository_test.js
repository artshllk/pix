import bcrypt from 'bcrypt';

import { Organization } from '../../../../../src/organizational-entities/domain/models/Organization.js';
import { Tag } from '../../../../../src/organizational-entities/domain/models/Tag.js';
import { config as settings } from '../../../../../src/shared/config.js';
import { ORGANIZATION_FEATURE } from '../../../../../src/shared/domain/constants.js';
import { UserNotFoundError } from '../../../../../src/shared/domain/errors.js';
import { ForbiddenAccess } from '../../../../../src/shared/domain/errors.js';
import { Membership } from '../../../../../src/shared/domain/models/Membership.js';
import { UserOrgaSettings } from '../../../../../src/shared/domain/models/UserOrgaSettings.js';
import { Prescriber } from '../../../../../src/team/domain/read-models/Prescriber.js';
import { prescriberRepository } from '../../../../../src/team/infrastructure/repositories/prescriber-repository.js';
import { catchErr, databaseBuilder, expect } from '../../../../test-helper.js';

describe('Integration | Team | Infrastructure | Repository | Prescriber', function () {
  const userToInsert = {
    firstName: 'estelle',
    lastName: 'popopo',
    email: 'estelle.popopo@example.net',
    lang: 'fr',
    /* eslint-disable-next-line no-sync, mocha/no-setup-in-describe */
    password: bcrypt.hashSync('A124B2C3#!', 1),
    cgu: true,
    samlId: 'some-saml-id',
    shouldChangePassword: false,
  };

  let user;
  let organization;
  let membership;
  let userOrgaSettings;

  describe('#getPrescriber', function () {
    let expectedPrescriber;

    context('when user is not a prescriber', function () {
      it('should throw a ForbiddenAccess error', async function () {
        // given
        const userId = databaseBuilder.factory.buildUser().id;
        await databaseBuilder.commit();

        // when
        const error = await catchErr(prescriberRepository.getPrescriber)(userId);

        // then
        expect(error).to.be.an.instanceOf(ForbiddenAccess);
      });
    });

    context('when user is a prescriber', function () {
      beforeEach(async function () {
        user = databaseBuilder.factory.buildUser(userToInsert);
        organization = databaseBuilder.factory.buildOrganization();
        membership = databaseBuilder.factory.buildMembership({
          id: 3000001,
          userId: user.id,
          organizationId: organization.id,
        });
        userOrgaSettings = databaseBuilder.factory.buildUserOrgaSettings({
          userId: user.id,
          currentOrganizationId: organization.id,
        });

        await databaseBuilder.commit();

        expectedPrescriber = {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          pixOrgaTermsOfServiceAccepted: user.pixOrgaTermsOfServiceAccepted,
          lang: user.lang,
        };
      });

      it('should return the found prescriber', async function () {
        // when
        const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

        // then
        expect(foundPrescriber).to.be.an.instanceOf(Prescriber);
        expect(foundPrescriber.id).to.equal(expectedPrescriber.id);
        expect(foundPrescriber.firstName).to.equal(expectedPrescriber.firstName);
        expect(foundPrescriber.lastName).to.equal(expectedPrescriber.lastName);
        expect(foundPrescriber.pixOrgaTermsOfServiceAccepted).to.equal(
          expectedPrescriber.pixOrgaTermsOfServiceAccepted,
        );
        expect(foundPrescriber.lang).to.equal(expectedPrescriber.lang);
      });

      it('should return a UserNotFoundError if no user is found', async function () {
        // given
        const nonExistentUserId = 678;

        // when
        const result = await catchErr(prescriberRepository.getPrescriber)(nonExistentUserId);

        // then
        expect(result).to.be.instanceOf(UserNotFoundError);
      });

      it('should return memberships associated to the prescriber', async function () {
        // given
        expectedPrescriber.memberships = [membership];

        // when
        const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

        // then
        const firstMembership = foundPrescriber.memberships[0];
        expect(firstMembership).to.be.an.instanceof(Membership);
        expect(firstMembership.id).to.equal(expectedPrescriber.memberships[0].id);

        const associatedOrganization = firstMembership.organization;
        expect(associatedOrganization).to.be.an.instanceof(Organization);
        expect(associatedOrganization.id).to.equal(organization.id);
        expect(associatedOrganization.code).to.equal(organization.code);
        expect(associatedOrganization.credit).to.equal(organization.credit);
        expect(associatedOrganization.name).to.equal(organization.name);
        expect(associatedOrganization.type).to.equal(organization.type);
      });

      it('should return memberships ordered by id', async function () {
        // given
        const anotherMembership = databaseBuilder.factory.buildMembership({ id: 3000000, userId: user.id });
        expectedPrescriber.memberships = [membership, anotherMembership];
        await databaseBuilder.commit();

        // when
        const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

        // then
        expect(foundPrescriber.memberships[0].id).to.equal(3000000);
        expect(foundPrescriber.memberships[1].id).to.equal(3000001);
      });

      it('should return user-orga-settings associated to the prescriber', async function () {
        // given
        expectedPrescriber.userOrgaSettings = userOrgaSettings;

        // when
        const foundUser = await prescriberRepository.getPrescriber(user.id);

        // then
        expect(foundUser.userOrgaSettings).to.be.an.instanceOf(UserOrgaSettings);
        expect(foundUser.userOrgaSettings.id).to.equal(expectedPrescriber.userOrgaSettings.id);
        expect(foundUser.userOrgaSettings.currentOrganization.id).to.equal(
          expectedPrescriber.userOrgaSettings.currentOrganizationId,
        );
      });

      it('should return information about organization in user-orga-settings associated to the prescriber', async function () {
        // given
        expectedPrescriber.userOrgaSettings = userOrgaSettings;
        const expectedOrganization = new Organization(organization);
        // when
        const foundUser = await prescriberRepository.getPrescriber(user.id);

        // then
        expect(foundUser.userOrgaSettings.currentOrganization).to.be.an.instanceOf(Organization);
        expect(foundUser.userOrgaSettings.currentOrganization).to.deep.contains(expectedOrganization);
      });

      context('when current organization defined in user-orga-settings has tags', function () {
        it('should return a list of tags', async function () {
          // given
          const tag1 = databaseBuilder.factory.buildTag({ name: 'AGRICULTURE' });
          databaseBuilder.factory.buildOrganizationTag({ organizationId: organization.id, tagId: tag1.id });
          const tag2 = databaseBuilder.factory.buildTag({ name: 'OTHER' });
          databaseBuilder.factory.buildOrganizationTag({ organizationId: organization.id, tagId: tag2.id });

          await databaseBuilder.commit();

          // when
          const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

          // then
          expect(foundPrescriber.userOrgaSettings.currentOrganization.tags.map((tag) => tag.name)).to.have.members([
            'OTHER',
            'AGRICULTURE',
          ]);
          expect(foundPrescriber.userOrgaSettings.currentOrganization.tags[0]).to.be.instanceOf(Tag);
        });
      });
      context('when organization is a school', function () {
        it('should set code into organizations associated to the prescriber', async function () {
          // given
          const school = databaseBuilder.factory.buildSchool();
          databaseBuilder.factory.buildMembership({
            userId: user.id,
            organizationId: school.organizationId,
          });
          await databaseBuilder.commit();

          // when
          const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

          // then
          const schoolMembership = foundPrescriber.memberships.find(
            (membership) => membership.organization.id === school.organizationId,
          );
          expect(schoolMembership.organization.schoolCode).to.equal(school.code);
        });

        it('should set sessionExpirationDate into current organization associated to the prescriber', async function () {
          // given
          const school = databaseBuilder.factory.buildSchool({
            organizationId: userOrgaSettings.currentOrganizationId,
            sessionExpirationDate: new Date('2013-03-04'),
          });
          await databaseBuilder.commit();

          // when
          const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

          // then
          expect(foundPrescriber.userOrgaSettings.currentOrganization.sessionExpirationDate).to.deep.equal(
            school.sessionExpirationDate,
          );
        });
      });

      describe('#areNewYearOrganizationLearnersImported', function () {
        context('when newYearOrganizationLearnersImportDate is defined in the env.', function () {
          let originalEnvValue;
          beforeEach(function () {
            originalEnvValue = settings.features.newYearOrganizationLearnersImportDate;
            settings.features.newYearOrganizationLearnersImportDate = '2020-08-15T00:00:00Z';
          });

          afterEach(function () {
            settings.features.newYearOrganizationLearnersImportDate = originalEnvValue;
          });

          it('should return areNewYearOrganizationLearnersImported as true if there is at least one organization-learners created after the date in the env. for the organization', async function () {
            // given
            const userId = databaseBuilder.factory.buildUser().id;
            const organizationId = databaseBuilder.factory.buildOrganization().id;
            databaseBuilder.factory.buildMembership({ userId, organizationId });
            databaseBuilder.factory.buildUserOrgaSettings({ userId, currentOrganizationId: organizationId });
            databaseBuilder.factory.buildOrganizationLearner({ organizationId, createdAt: new Date('2020-08-17') });
            await databaseBuilder.commit();

            // when
            const foundPrescriber = await prescriberRepository.getPrescriber(userId);

            // then
            expect(foundPrescriber.areNewYearOrganizationLearnersImported).to.be.true;
          });
        });

        context('when newYearOrganizationLearnersImportDate is not defined in the env.', function () {
          let originalEnvValue;
          beforeEach(function () {
            originalEnvValue = settings.features.newYearOrganizationLearnersImportDate;
            settings.features.newYearOrganizationLearnersImportDate = null;
          });

          afterEach(function () {
            settings.features.newYearOrganizationLearnersImportDate = originalEnvValue;
          });

          it('should return areNewYearOrganizationLearnersImported as true if there is at least one organization-learners created for the organization', async function () {
            // given
            const userId = databaseBuilder.factory.buildUser().id;
            const organizationId = databaseBuilder.factory.buildOrganization().id;
            databaseBuilder.factory.buildMembership({ userId, organizationId });
            databaseBuilder.factory.buildUserOrgaSettings({ userId, currentOrganizationId: organizationId });
            databaseBuilder.factory.buildOrganizationLearner({ organizationId });
            await databaseBuilder.commit();

            // when
            const foundPrescriber = await prescriberRepository.getPrescriber(userId);

            // then
            expect(foundPrescriber.areNewYearOrganizationLearnersImported).to.be.true;
          });
        });

        context(
          'when there is no organization-learners created for the organization of the user-orga-settings',
          function () {
            let originalEnvValue;
            beforeEach(function () {
              originalEnvValue = settings.features.newYearOrganizationLearnersImportDate;
              settings.features.newYearOrganizationLearnersImportDate = '2020-08-15T00:00:00Z';
            });

            afterEach(function () {
              settings.features.newYearOrganizationLearnersImportDate = originalEnvValue;
            });

            it('should return areNewYearOrganizationLearnersImported as false', async function () {
              // given
              const userId = databaseBuilder.factory.buildUser().id;
              const organizationId = databaseBuilder.factory.buildOrganization().id;
              databaseBuilder.factory.buildMembership({ userId, organizationId });
              databaseBuilder.factory.buildUserOrgaSettings({ userId, currentOrganizationId: organizationId });
              databaseBuilder.factory.buildOrganizationLearner({ organizationId, createdAt: new Date('2020-07-17') });
              await databaseBuilder.commit();

              // when
              const foundPrescriber = await prescriberRepository.getPrescriber(userId);

              // then
              expect(foundPrescriber.areNewYearOrganizationLearnersImported).to.be.false;
            });
          },
        );
      });

      describe('#participantCount', function () {
        it('should only count learners in currentOrganization', async function () {
          // given
          databaseBuilder.factory.buildOrganizationLearner({
            organizationId: organization.id,
          });
          databaseBuilder.factory.buildOrganizationLearner();
          await databaseBuilder.commit();

          // when
          const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

          // then
          expect(foundPrescriber.participantCount).to.equal(1);
        });

        it('should not count anonymous users', async function () {
          // given
          const userId = databaseBuilder.factory.buildUser({ isAnonymous: true }).id;
          databaseBuilder.factory.buildOrganizationLearner({
            userId,
            organizationId: organization.id,
          });
          await databaseBuilder.commit();

          // when
          const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

          // then
          expect(foundPrescriber.participantCount).to.equal(0);
        });

        it('should not count disabled organization learners', async function () {
          // given
          databaseBuilder.factory.buildOrganizationLearner({
            organizationId: organization.id,
            isDisabled: true,
          });
          await databaseBuilder.commit();

          // when
          const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

          // then
          expect(foundPrescriber.participantCount).to.equal(0);
        });

        it('should count all organization learners when several exists', async function () {
          // given
          databaseBuilder.factory.buildOrganizationLearner({
            organizationId: organization.id,
          });
          databaseBuilder.factory.buildOrganizationLearner({
            organizationId: organization.id,
          });
          await databaseBuilder.commit();

          // when
          const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

          // then
          expect(foundPrescriber.participantCount).to.equal(2);
        });
      });

      context('features', function () {
        it('should return features for current organization', async function () {
          // given
          const multipleSendingFeature = databaseBuilder.factory.buildFeature(
            ORGANIZATION_FEATURE.MULTIPLE_SENDING_ASSESSMENT,
          );
          const placesManagementFeature = databaseBuilder.factory.buildFeature(ORGANIZATION_FEATURE.PLACES_MANAGEMENT);
          databaseBuilder.factory.buildFeature(ORGANIZATION_FEATURE.COMPUTE_ORGANIZATION_LEARNER_CERTIFICABILITY);

          databaseBuilder.factory.buildOrganizationFeature({
            featureId: multipleSendingFeature.id,
            organizationId: organization.id,
          });
          databaseBuilder.factory.buildOrganizationFeature({
            featureId: placesManagementFeature.id,
            organizationId: organization.id,
          });
          await databaseBuilder.commit();

          // when
          const foundPrescriber = await prescriberRepository.getPrescriber(user.id);

          // then
          expect(foundPrescriber.features).to.deep.equal({
            [ORGANIZATION_FEATURE.COMPUTE_ORGANIZATION_LEARNER_CERTIFICABILITY.key]: false,
            [ORGANIZATION_FEATURE.MULTIPLE_SENDING_ASSESSMENT.key]: true,
            [ORGANIZATION_FEATURE.PLACES_MANAGEMENT.key]: true,
          });
        });
      });
    });
  });
});
