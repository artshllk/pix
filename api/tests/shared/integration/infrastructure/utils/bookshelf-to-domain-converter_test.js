import { User } from '../../../../../src/identity-access-management/domain/models/User.js';
import { Organization } from '../../../../../src/organizational-entities/domain/models/Organization.js';
import { Tag } from '../../../../../src/organizational-entities/domain/models/Tag.js';
import { KnowledgeElement } from '../../../../../src/shared/domain/models/KnowledgeElement.js';
import { Membership } from '../../../../../src/shared/domain/models/Membership.js';
import { TargetProfile } from '../../../../../src/shared/domain/models/TargetProfile.js';
import { BookshelfCampaign } from '../../../../../src/shared/infrastructure/orm-models/Campaign.js';
import { BookshelfCampaignParticipation } from '../../../../../src/shared/infrastructure/orm-models/CampaignParticipation.js';
import { BookshelfOrganization } from '../../../../../src/shared/infrastructure/orm-models/Organization.js';
import { BookshelfUser } from '../../../../../src/shared/infrastructure/orm-models/User.js';
import * as bookshelfToDomainConverter from '../../../../../src/shared/infrastructure/utils/bookshelf-to-domain-converter.js';
import { databaseBuilder, expect } from '../../../../test-helper.js';

describe('Integration | Infrastructure | Utils | Bookshelf to domain converter', function () {
  describe('buildDomainObject', function () {
    it('should convert a Bookshelf object into a domain object', async function () {
      // given
      const userId = databaseBuilder.factory.buildUser().id;
      await databaseBuilder.commit();
      const bookshelfObject = await BookshelfUser.where({ id: userId }).fetch();

      // when
      const domainObject = bookshelfToDomainConverter.buildDomainObject(BookshelfUser, bookshelfObject);

      // then
      expect(domainObject).to.be.an.instanceOf(User);
    });

    it('should populate the domain object with the matching Bookshelf properties', async function () {
      // given
      const userId = databaseBuilder.factory.buildUser().id;
      await databaseBuilder.commit();
      const bookshelfObject = await BookshelfUser.where({ id: userId }).fetch();

      // when
      const domainObject = bookshelfToDomainConverter.buildDomainObject(BookshelfUser, bookshelfObject);

      // then
      for (const property of ['firstName', 'lastName', 'email']) {
        expect(domainObject[property]).to.exist;
      }
    });

    it('should honor the domain object constructor', async function () {
      // given
      const userId = databaseBuilder.factory.buildUser().id;
      await databaseBuilder.commit();
      const bookshelfObject = await BookshelfUser.where({ id: userId }).fetch();

      // when
      const domainObject = bookshelfToDomainConverter.buildDomainObject(BookshelfUser, bookshelfObject);

      // then
      expect(domainObject.scorecards).to.deep.equal([]);
    });

    it('should support has-one relationships', async function () {
      // TODO : Il n'y a pas d'exemple d'objet du Domain qui récupère un autre objet du Domain via hasOne.
    });

    it('should support has-many relationships', async function () {
      // given
      const userId = databaseBuilder.factory.buildUser().id;
      databaseBuilder.factory.buildMembership({ userId });
      databaseBuilder.factory.buildMembership({ userId });
      await databaseBuilder.commit();
      const bookshelfObject = await BookshelfUser.where({ id: userId }).fetch({
        withRelated: ['memberships'],
      });

      // when
      const domainObject = bookshelfToDomainConverter.buildDomainObject(BookshelfUser, bookshelfObject);

      // then
      expect(domainObject.memberships).to.be.instanceOf(Array);
      expect(domainObject.memberships[0]).to.be.instanceOf(Membership);
    });

    it('should support belongs-to relationships', async function () {
      //given
      const campaignId = databaseBuilder.factory.buildCampaign().id;
      await databaseBuilder.commit();
      const bookshelfObject = await BookshelfCampaign.where({ id: campaignId }).fetch({
        withRelated: ['targetProfile'],
      });

      // when
      const domainObject = bookshelfToDomainConverter.buildDomainObject(BookshelfCampaign, bookshelfObject);

      // then
      expect(domainObject.targetProfile).to.be.instanceOf(TargetProfile);
    });

    it('should support belongs-to-many relationships', async function () {
      //given
      const organizationId = databaseBuilder.factory.buildOrganization().id;
      const tagId1 = databaseBuilder.factory.buildTag({ name: 'Banane' }).id;
      const tagId2 = databaseBuilder.factory.buildTag({ name: 'Dinde' }).id;
      databaseBuilder.factory.buildOrganizationTag({ organizationId, tagId: tagId1 });
      databaseBuilder.factory.buildOrganizationTag({ organizationId, tagId: tagId2 });
      await databaseBuilder.commit();
      const bookshelfObject = await BookshelfOrganization.where({ id: organizationId }).fetch({
        withRelated: ['tags'],
      });

      // when
      const domainObject = bookshelfToDomainConverter.buildDomainObject(BookshelfOrganization, bookshelfObject);

      // then
      expect(domainObject.tags).to.be.instanceOf(Array);
      expect(domainObject.tags[0]).to.be.instanceOf(Tag);
      expect(domainObject.tags.length).to.equal(2);
    });

    it('should support domain object relationship’s name not matching the corresponding Bookshelf class name', async function () {
      // given
      const userId = databaseBuilder.factory.buildUser().id;
      databaseBuilder.factory.buildKnowledgeElement({ userId });
      databaseBuilder.factory.buildKnowledgeElement({ userId });
      await databaseBuilder.commit();
      const bookshelfObject = await BookshelfUser.where({ id: userId }).fetch({
        withRelated: 'knowledgeElements',
      });

      // when
      const domainObject = bookshelfToDomainConverter.buildDomainObject(BookshelfUser, bookshelfObject);

      // then
      expect(domainObject.knowledgeElements).to.be.instanceOf(Array);
      expect(domainObject.knowledgeElements[0]).to.be.instanceOf(KnowledgeElement);
    });

    it('should support nested relationships', async function () {
      // given
      const organizationId = databaseBuilder.factory.buildOrganization().id;
      const campaignId = databaseBuilder.factory.buildCampaign({ organizationId }).id;
      const campaignParticipationId = databaseBuilder.factory.buildCampaignParticipation({ campaignId }).id;
      await databaseBuilder.commit();
      const bookshelfObject = await BookshelfCampaignParticipation.where({ id: campaignParticipationId }).fetch({
        withRelated: ['campaign.organization'],
      });

      // when
      const domainObject = bookshelfToDomainConverter.buildDomainObject(
        BookshelfCampaignParticipation,
        bookshelfObject,
      );

      // then
      expect(domainObject.campaign.organization).to.be.instanceOf(Organization);
    });
  });
});
