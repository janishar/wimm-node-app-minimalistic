import express from 'express';
import { ProtectedRequest } from 'app-request';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import validator, { ValidationSource } from '../../helpers/validator';
import schema from './schema';
import role from '../../helpers/role';
import authentication from '../../auth/authentication';
import authorization from '../../auth/authorization';
import { RoleCode } from '../../database/model/Role';
import ContentRepo from '../../database/repository/ContentRepo';
import { Types } from 'mongoose';
import MentorRepo from '../../database/repository/MentorRepo';
import { BadRequestError, NotFoundError } from '../../core/ApiError';
import TopicRepo from '../../database/repository/TopicRepo';
import SubscriptionRepo from '../../database/repository/SubscriptionRepo';
import Content from '../../database/model/Content';
import { statsBoostUp } from '../content/utils';
import personal from './personal';

const router = express.Router();

router.use('/my', personal);

/*----------------------------------------------------------------*/
router.use(authentication, role(RoleCode.VIEWER), authorization);
/*----------------------------------------------------------------*/

router.get(
  '/mentor/:id',
  validator(schema.id, ValidationSource.PARAM),
  validator(schema.pagination, ValidationSource.QUERY),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const mentor = await MentorRepo.findById(new Types.ObjectId(req.params.id));
    if (!mentor) throw new NotFoundError('Mentor not found');

    const contents = await ContentRepo.findMentorContentsPaginated(
      mentor,
      parseInt(req.query.pageNumber as string),
      parseInt(req.query.pageItemCount as string),
    );

    new SuccessResponse('Success', contents).send(res);
  }),
);

router.get(
  '/topic/:id',
  validator(schema.id, ValidationSource.PARAM),
  validator(schema.pagination, ValidationSource.QUERY),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const topic = await TopicRepo.findById(new Types.ObjectId(req.params.id));
    if (!topic) throw new NotFoundError('Topic not found');

    const contents = await ContentRepo.findTopicContentsPaginated(
      topic,
      parseInt(req.query.pageNumber as string),
      parseInt(req.query.pageItemCount as string),
    );

    new SuccessResponse('Success', contents).send(res);
  }),
);

router.get(
  '/rotated',
  validator(schema.rotatedPagination, ValidationSource.QUERY),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const subscription = await SubscriptionRepo.findSubscriptionForUser(
      req.user,
    );
    if (!subscription) throw new BadRequestError('Subscription not found');

    const pageNumber = parseInt(req.query.pageNumber as string);
    const pageItemCount = parseInt(req.query.pageItemCount as string);
    const empty = req.query.empty === 'true';

    const data: Content[] = [];

    if (empty == true || pageNumber == 1) {
      const latestContents =
        await ContentRepo.findSubscriptionContentsPaginated(
          subscription,
          pageNumber,
          pageItemCount,
        );
      data.push(...latestContents);
    }

    const contents = await ContentRepo.findContentsPaginated(
      pageNumber,
      pageItemCount,
    );

    for (const content of contents) {
      const found = data.find((c) => c._id.equals(content._id));
      if (!found) data.push(content);
    }

    const likedContents = await ContentRepo.findUserAndContentsLike(
      req.user,
      data.map((content) => content._id),
    );

    for (const content of data) {
      const found = likedContents.find((liked) =>
        liked._id.equals(content._id),
      );
      content.liked = found ? true : false;
      statsBoostUp(content);
    }

    new SuccessResponse('Success', data).send(res);
  }),
);

export default router;
