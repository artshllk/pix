import { getCertificationCandidateSubscription } from '../../../../../../src/certification/enrolment/domain/usecases/get-certification-candidate-subscription.js';
import { domainBuilder, expect, sinon } from '../../../../../test-helper.js';

describe('Certification | Enrolment | Unit | Domain | UseCase | get-certification-candidate-subscription', function () {
  let certificationBadgesService;
  let certificationCandidateRepository;
  let centerRepository;
  let certificationCandidateData;
  const certificationCandidateId = 123;
  const userId = 456;
  const sessionId = 789;
  let sessionRepository;

  beforeEach(function () {
    certificationBadgesService = {
      findStillValidBadgeAcquisitions: sinon.stub(),
    };
    certificationCandidateRepository = {
      getWithComplementaryCertification: sinon.stub(),
    };

    centerRepository = {
      getById: sinon.stub(),
    };

    certificationCandidateData = {
      id: certificationCandidateId,
      userId,
      sessionId,
      subscriptions: [domainBuilder.buildCoreSubscription()],
    };

    sessionRepository = {
      get: sinon.stub(),
    };
  });

  context('when certification center is not habilitated', function () {
    context('when the candidate is registered and eligible to one complementary certification', function () {
      it('should return the candidate without eligible complementary certification', async function () {
        // given

        const complementaryCertification = domainBuilder.buildComplementaryCertification({ key: 'PIX+' });

        const certifiableBadgeAcquisition = domainBuilder.buildCertifiableBadgeAcquisition({
          badge: domainBuilder.buildBadge({
            key: 'PIX+_BADGE',
            isCertifiable: true,
          }),
          complementaryCertification,
        });

        const candidateWithComplementaryCertification = domainBuilder.buildCertificationCandidate({
          ...certificationCandidateData,
          complementaryCertification,
        });

        const center = domainBuilder.certification.enrolment.buildCenter({
          habilitations: [],
        });

        certificationCandidateRepository.getWithComplementaryCertification
          .withArgs({ id: certificationCandidateId })
          .resolves(candidateWithComplementaryCertification);

        sessionRepository.get.withArgs({ id: sessionId }).resolves(
          domainBuilder.certification.enrolment.buildSession({
            certificationCenterId: 777,
            version: 2,
          }),
        );

        centerRepository.getById.withArgs({ id: 777 }).resolves(center);

        certificationBadgesService.findStillValidBadgeAcquisitions
          .withArgs({ userId })
          .resolves([certifiableBadgeAcquisition]);

        // when
        const certificationCandidateSubscription = await getCertificationCandidateSubscription({
          certificationCandidateId,
          certificationBadgesService,
          certificationCandidateRepository,
          centerRepository,
          sessionRepository,
        });

        // then
        expect(certificationCandidateSubscription).to.deep.equal(
          domainBuilder.buildCertificationCandidateSubscription({
            id: certificationCandidateId,
            sessionId,
            eligibleSubscription: null,
            nonEligibleSubscription: null,
            sessionVersion: 2,
          }),
        );
      });
    });
  });

  context('when certification center is habilitated', function () {
    context('when the candidate is not registered but eligible to one complementary certification', function () {
      it('should return the candidate without any complementary certification', async function () {
        // given
        const certificationCandidateId = 123;
        const userId = 456;
        const sessionId = 789;

        const complementaryCertification = domainBuilder.buildComplementaryCertification({ key: 'PIX+' });

        const center = domainBuilder.certification.enrolment.buildCenter({
          habilitations: [
            domainBuilder.certification.enrolment.buildHabilitation({
              key: 'PIX+',
            }),
          ],
        });

        const certifiableBadgeAcquisition = domainBuilder.buildCertifiableBadgeAcquisition({
          badge: domainBuilder.buildBadge({
            key: 'PIX+_BADGE',
            isCertifiable: true,
          }),
          complementaryCertification,
        });

        const candidateWithoutComplementaryCertification = domainBuilder.buildCertificationCandidate({
          ...certificationCandidateData,
          complementaryCertification: null,
        });
        certificationCandidateRepository.getWithComplementaryCertification
          .withArgs({ id: certificationCandidateId })
          .resolves(candidateWithoutComplementaryCertification);

        sessionRepository.get.withArgs({ id: sessionId }).resolves(
          domainBuilder.certification.enrolment.buildSession({
            certificationCenterId: 777,
            version: 2,
          }),
        );

        centerRepository.getById.withArgs({ id: 777 }).resolves(center);

        certificationBadgesService.findStillValidBadgeAcquisitions
          .withArgs({ userId })
          .resolves([certifiableBadgeAcquisition]);

        // when
        const certificationCandidateSubscription = await getCertificationCandidateSubscription({
          certificationCandidateId,
          certificationBadgesService,
          certificationCandidateRepository,
          centerRepository,
          sessionRepository,
        });

        // then
        expect(certificationCandidateSubscription).to.deep.equal(
          domainBuilder.buildCertificationCandidateSubscription({
            id: certificationCandidateId,
            sessionId,
            eligibleSubscription: null,
            nonEligibleSubscription: null,
            sessionVersion: 2,
          }),
        );
      });
    });
  });
});
