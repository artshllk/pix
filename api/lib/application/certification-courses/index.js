import Joi from 'joi';

import { securityPreHandlers } from '../../../src/shared/application/security-pre-handlers.js';
import { identifiersType } from '../../../src/shared/domain/types/identifiers-type.js';
import { certificationCourseController } from './certification-course-controller.js';

const register = async function (server) {
  const adminRoutes = [
    {
      method: 'GET',
      path: '/api/admin/certifications/{id}/certified-profile',
      config: {
        pre: [
          {
            method: (request, h) =>
              securityPreHandlers.hasAtLeastOneAccessOf([
                securityPreHandlers.checkAdminMemberHasRoleSuperAdmin,
                securityPreHandlers.checkAdminMemberHasRoleCertif,
                securityPreHandlers.checkAdminMemberHasRoleSupport,
                securityPreHandlers.checkAdminMemberHasRoleMetier,
              ])(request, h),
            assign: 'hasAuthorizationToAccessAdminScope',
          },
        ],
        validate: {
          params: Joi.object({
            id: identifiersType.certificationCourseId,
          }),
        },
        handler: certificationCourseController.getCertifiedProfile,
        tags: ['api'],
        notes: [
          'Cette route est utilisé par Pix Admin',
          'Elle permet de récupérer le profil certifié pour une certification donnée',
        ],
      },
    },
  ];
  server.route([
    ...adminRoutes,
    {
      method: 'POST',
      path: '/api/certification-courses',
      config: {
        handler: certificationCourseController.save,
        validate: {
          payload: Joi.object({
            data: {
              attributes: {
                'access-code': Joi.string().required(),
                'session-id': identifiersType.sessionId,
              },
            },
          }),
          headers: Joi.object({
            'accept-language': Joi.string(),
          }),
          options: {
            allowUnknown: true,
          },
        },
        notes: [
          '- **Route nécessitant une authentification**\n' +
            "- S'il existe déjà une certification pour l'utilisateur courant dans cette session, alors cette route renvoie la certification existante avec un code 200\n" +
            "- Sinon, crée une certification pour l'utilisateur courant dans la session indiquée par l'attribut *access-code*, et la renvoie avec un code 201\n",
        ],
        tags: ['api'],
      },
    },
    {
      method: 'GET',
      path: '/api/certification-courses/{id}',
      config: {
        pre: [
          {
            method: securityPreHandlers.checkUserOwnsCertificationCourse,
            assign: 'hasAuthorizationToAccessOwnCertificationCourse',
          },
        ],
        validate: {
          params: Joi.object({
            id: identifiersType.certificationCourseId,
          }),
        },
        handler: certificationCourseController.get,
        tags: ['api'],
      },
    },
  ]);
};

const name = 'certification-courses-api';
export { name, register };
