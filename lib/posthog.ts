import PostHog from 'posthog-react-native';

// Create PostHog instance that can be used throughout the app
export const posthog = new PostHog('phc_QqDag34ZeHH7lCMnB3KFZIoPkUczd2Q3YmWK109NUVw', {
  host: 'https://us.i.posthog.com',
  enableSessionReplay: true,
  errorTracking: {
    autocapture: {
      uncaughtExceptions: true,
      unhandledRejections: true,
      console: ['error', 'warn'],
    },
  },
});

