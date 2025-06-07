
// Google Analytics utility functions
export const GA_MEASUREMENT_ID = 'GA_MEASUREMENT_ID'; // Replace with your actual GA4 Measurement ID

// Track page views with enhanced data
export const trackPageView = (url, title) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_title: title,
      page_location: url,
      custom_map: {
        'custom_parameter_1': 'page_type'
      }
    });
  }
};

// Track custom events
export const trackEvent = (eventName, parameters = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
};

// Track weather check results with enhanced SEO data
export const trackWeatherCheck = (isGoodDay, criteriaMetCount) => {
  trackEvent('weather_check', {
    is_good_day: isGoodDay,
    criteria_met: criteriaMetCount,
    event_category: 'weather',
    weather_assessment: isGoodDay ? 'good_day' : 'not_good_day',
    engagement_quality: criteriaMetCount >= 3 ? 'high' : 'medium'
  });
};

// Track voting actions with user engagement data
export const trackVote = (voteType, weatherDate) => {
  trackEvent('vote', {
    vote_type: voteType,
    weather_date: weatherDate,
    event_category: 'engagement',
    user_interaction: 'vote_cast',
    engagement_type: 'user_feedback'
  });
};

// Track page interactions for Search Console insights
export const trackPageInteraction = (interactionType, details = {}) => {
  trackEvent('page_interaction', {
    interaction_type: interactionType,
    event_category: 'user_experience',
    ...details
  });
};

// Track external link clicks for SEO insights
export const trackExternalLink = (linkUrl, linkText) => {
  trackEvent('external_link_click', {
    link_url: linkUrl,
    link_text: linkText,
    event_category: 'outbound_links'
  });
};
