
// Google Analytics utility functions
export const GA_MEASUREMENT_ID = 'GA_MEASUREMENT_ID'; // Replace with your actual GA4 Measurement ID

// Track page views
export const trackPageView = (url, title) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_title: title,
      page_location: url,
    });
  }
};

// Track custom events
export const trackEvent = (eventName, parameters = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
};

// Track weather check results
export const trackWeatherCheck = (isGoodDay, criteriaMetCount) => {
  trackEvent('weather_check', {
    is_good_day: isGoodDay,
    criteria_met: criteriaMetCount,
    event_category: 'weather',
  });
};

// Track voting actions
export const trackVote = (voteType, weatherDate) => {
  trackEvent('vote', {
    vote_type: voteType,
    weather_date: weatherDate,
    event_category: 'engagement',
  });
};
