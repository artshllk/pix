import { updateJuryComment } from '../../../../../../src/certification/session-management/domain/usecases/update-jury-comment.js';
import { DomainTransaction } from '../../../../../../src/shared/domain/DomainTransaction.js';
import { AssessmentResult } from '../../../../../../src/shared/domain/models/index.js';
import { CompetenceMark } from '../../../../../../src/shared/domain/models/index.js';
import { domainBuilder, expect, sinon } from '../../../../../test-helper.js';

describe('Unit | UseCase | update-jury-comment', function () {
  beforeEach(function () {
    sinon.stub(DomainTransaction, 'execute').callsFake((callback) => {
      return callback();
    });
  });

  it('should save jury comment', async function () {
    // given
    const certificationCourseId = 123;
    const assessmentResultCommentByJury = 'Hello';
    const competenceMark = domainBuilder.buildCompetenceMark({});
    const oldAssessmentResult = domainBuilder.buildAssessmentResult({ id: 56, competenceMarks: [competenceMark] });
    const newAssessmentResult = domainBuilder.buildAssessmentResult({ id: 78, juryId: 456, commentByJury: 'Hello' });

    const courseAssessmentResultRepository = {
      getLatestAssessmentResult: sinon.stub().resolves(oldAssessmentResult),
    };
    const assessmentResultRepository = {
      save: sinon.stub().resolves(newAssessmentResult),
    };
    const sharedCompetenceMarkRepository = {
      save: sinon.stub().resolves(),
    };

    // when
    await updateJuryComment({
      certificationCourseId,
      assessmentResultCommentByJury,
      juryId: 456,
      assessmentResultRepository,
      sharedCompetenceMarkRepository,
      courseAssessmentResultRepository,
    });

    // then
    expect(courseAssessmentResultRepository.getLatestAssessmentResult).to.have.been.calledOnceWith({
      certificationCourseId,
    });
    expect(assessmentResultRepository.save).to.have.been.calledOnceWith({
      certificationCourseId,
      assessmentResult: sinon.match.instanceOf(AssessmentResult).and(
        sinon.match({
          ...oldAssessmentResult.clone,
          id: undefined,
          juryId: 456,
          emitter: AssessmentResult.emitters.PIX_JURY,
          commentByJury: assessmentResultCommentByJury,
        }),
      ),
    });
    expect(sharedCompetenceMarkRepository.save).to.have.been.calledOnceWith(
      sinon.match.instanceOf(CompetenceMark).and(
        sinon.match({
          ...competenceMark,
          assessmentResultId: newAssessmentResult.id,
        }),
      ),
    );
  });
});
