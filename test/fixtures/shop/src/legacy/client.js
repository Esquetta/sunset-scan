const LemonSqueezy = require('@lemonsqueezy/lemonsqueezy.js');

const ls = new LemonSqueezy(process.env.LEMONSQUEEZY_API_KEY);

module.exports.listActive = () => ls.getSubscriptions({ status: 'active' });
