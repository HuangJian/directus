/**
 *  RateLimiter using Redis
 *  and rate-limiter-flexible
 *  can extend with further options
 *  in future
 */
import { RequestHandler } from 'express';
import redis from 'redis';
import asyncHandler from 'express-async-handler';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { HitRateLimitException } from '../exceptions';
import { RedisNotFoundException } from '../exceptions';
import env from '../env';

const redisClient = redis.createClient({
	enable_offline_queue: false,
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
	password: env.REDIS_PASSWORD,
});

const rateLimiter: RequestHandler = asyncHandler(async (req, res, next) => {
	// options for the rate limiter are set below. Opts can be found
	// at https://github.com/animir/node-rate-limiter-flexible/wiki/Options
	// more basic for memory store
	const opts = {
		points: env.CONSUMED_POINTS_LIMIT, // Number of points
		duration: env.CONSUMED_RESET_DURATION, // Number of seconds before consumed points are reset.
		keyPrefix: 'rlflx', // must be unique for limiters with different purpose
	};

	let rateLimiterSet = new RateLimiterMemory(opts);

	if (env.RATE_LIMIT_TYPE === 'redis') {
		const redisOpts = {
			...opts,
			storeClient: redisClient,
			// Custom
			execEvenly: env.EXEC_EVENLY, // delay actions after first action - this may need adjusting (leaky bucket)
			blockDuration: env.BLOCK_POINT_DURATION, // Do not block if consumed more than points
			inmemoryBlockOnConsumed: env.INMEMORY_BLOCK_CONSUMED, // eg if 200 points consumed
			inmemoryBlockDuration: env.INMEMEMORY_BLOCK_DURATION, // block for certain amount of seconds
		};

		rateLimiterSet = new RateLimiterRedis(redisOpts);

		// first need to check that redis is running!
		if (!redisClient) {
			throw new RedisNotFoundException('Redis client does not exist');
		}
	}

	try {
		await rateLimiterSet.consume(req.ip);
	} catch (rejRes) {
		// If there is no error, rateLimiterRedis promise rejected with number of ms before next request allowed
		const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
		res.set('Retry-After', String(secs));
		throw new HitRateLimitException(`Too many requests, retry after ${secs}.`);
	}

	return next();
});

export default rateLimiter;
