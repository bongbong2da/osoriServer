import express from 'express';
import { Op } from 'sequelize';
import sequelize from '../models';
import { getCaller, makeFilter, makePagination, trimNull } from '../utils/objectUtil';

const FeedRouter = express.Router();
const Article = sequelize.article;
const User = sequelize.user;
const Follow = sequelize.follow;

FeedRouter.get('/feeds', async (req, res) => {
  const { filter, offset } = makeFilter(req.query);
  const caller = getCaller(req.get('Authorization'));

  if (!caller) {
    res.status(400);
    res.send('잘못된 호출입니다.');
  } else {
    await Follow.findAll({ where: { follower: caller.id } }).then(async (result) => {
      const followeeIds = result.map((follow) => follow.followee);
      console.log('finding in', followeeIds);
      await Article.findAndCountAll({
        offset,
        limit: filter.size,
        // @ts-ignore
        where: { creatorId: { [Op.in]: followeeIds } },
      }).then(async (result) => {
        const { count, rows } = result;
        const payloads = await Promise.all(
          rows.map(async (article) => {
            const creator = await User.findOne({ where: { id: article.creatorId } });
            if (creator) {
              const followerCount = await Follow.count({ where: { followee: creator.id } });
              return {
                ...trimNull(article.get()),
                creator: { ...trimNull(creator.get()), followerCount },
              };
            }
            return {
              ...trimNull(article.get()),
            };
          }),
        );
        const pagination = makePagination(filter, payloads.length, count);
        res.setHeader('Authorization', pagination);
        res.send(payloads);
      });
    });
  }
});

export default FeedRouter;
