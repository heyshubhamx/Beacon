const TelegramBot = require('node-telegram-bot-api');
const { db } = require('../../db');
const { enqueueNotificationJob } = require('../workers/pushWorker');

function setupTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const authorizedId = process.env.TELEGRAM_AUTHORIZED_USER_ID;

  if (!token || !authorizedId) {
    console.log('Telegram bot not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_AUTHORIZED_USER_ID).');
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });
  console.log('Telegram Bot engine started');

  const sessions = {};

  const isAuthorized = (msgOrQuery) => {
    const fromId = msgOrQuery.from.id.toString();
    return fromId === authorizedId.toString();
  };

  bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, 'Unauthorized access.');
    
    bot.sendMessage(msg.chat.id, `Welcome to Beacon! 🚀\n\nCommands:\n/newcampaign - Send a new notification\n/campaigns - View recent campaigns\n/stats - View quick stats\n/cancel - Cancel current operation`, {
      reply_markup: {
        keyboard: [
          ['/newcampaign', '/campaigns'],
          ['/stats', '/cancel']
        ],
        resize_keyboard: true
      }
    });
  });

  bot.onText(/\/cancel/, (msg) => {
    if (!isAuthorized(msg)) return;
    delete sessions[msg.chat.id];
    bot.sendMessage(msg.chat.id, 'Operation cancelled or none was active.', {
      reply_markup: { remove_keyboard: true }
    });
  });
  
  bot.onText(/\/stats/, async (msg) => {
    if (!isAuthorized(msg)) return;
    try {
      const { count: webCount } = await db.from('websites').select('*', { count: 'exact', head: true });
      const { count: subCount } = await db.from('subscriptions').select('*', { count: 'exact', head: true });
      
      bot.sendMessage(msg.chat.id, `📊 *Beacon Stats*\n\nActive Websites: ${webCount}\nTotal Subscribers: ${subCount}`, { parse_mode: 'Markdown' });
    } catch (e) {
      bot.sendMessage(msg.chat.id, 'Error fetching stats.');
    }
  });

  bot.onText(/\/campaigns/, async (msg) => {
    if (!isAuthorized(msg)) return;
    try {
      // Get the 5 most recent campaigns
      const { data: campaigns, error } = await db.from('notifications')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5);

      if (error || !campaigns || campaigns.length === 0) {
        return bot.sendMessage(msg.chat.id, 'No recent campaigns found.');
      }

      let response = `📈 *Recent Campaigns*\n`;
      campaigns.forEach((c, i) => {
        const title = c.title || (c.data?.campaign?.name) || 'Untitled';
        const sent = c.sentCount || 0;
        const delivered = c.deliveredCount || 0;
        const clicks = c.clickCount || 0;
        
        response += `\n*${i+1}. ${title}*\n`;
        response += `📦 Sent: ${sent} | 📨 Delivered: ${delivered} | 🖱️ Clicks: ${clicks}\n`;
      });

      bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    } catch (e) {
      bot.sendMessage(msg.chat.id, 'Error fetching campaigns.');
    }
  });

  bot.onText(/\/newcampaign/, async (msg) => {
    if (!isAuthorized(msg)) return;
    
    try {
      const { data: websites, error } = await db.from('websites').select('id, domain').eq('active', true);
      
      if (error || !websites || websites.length === 0) {
        return bot.sendMessage(msg.chat.id, 'No active websites found.');
      }

      sessions[msg.chat.id] = { step: 'select_target', targets: [] };
      
      const inlineKeyboard = websites.map(w => ([{ text: w.domain, callback_data: `target_${w.id}` }]));
      inlineKeyboard.push([{ text: "🌟 All Websites", callback_data: 'target_all' }]);

      bot.sendMessage(msg.chat.id, 'Step 1/4: Select the target audience:', {
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
      
    } catch (e) {
      console.error('Error starting builder:', e);
      bot.sendMessage(msg.chat.id, 'Error starting campaign builder.');
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    if (!isAuthorized(callbackQuery)) return;
    
    const data = callbackQuery.data;
    const session = sessions[msg.chat.id];
    
    if (!session) {
      return bot.answerCallbackQuery(callbackQuery.id, { text: 'Session expired. Type /newcampaign to start again.' });
    }

    if (session.step === 'select_target' && data.startsWith('target_')) {
      const target = data.replace('target_', '');
      session.targetType = target === 'all' ? 'all' : 'single';
      session.websiteId = target === 'all' ? null : target;
      session.step = 'await_title';
      
      bot.answerCallbackQuery(callbackQuery.id);
      bot.sendMessage(msg.chat.id, 'Target selected!\n\nStep 2/4: Please send me the *Title* of the notification.', { parse_mode: 'Markdown' });
    }
    else if (session.step === 'confirm' && data.startsWith('confirm_')) {
      bot.answerCallbackQuery(callbackQuery.id);
      
      if (data === 'confirm_yes') {
        bot.sendMessage(msg.chat.id, '🚀 Sending notification...');
        
        try {
          const payload = {
              title: session.title,
              options: {
                body: session.body,
                data: {}
              }
          };
          if (session.url) payload.options.data.url = session.url;
          if (session.actions && session.actions.length > 0) {
             payload.options.actions = session.actions;
          }
          
          if (session.targetType === 'all') {
            const { data: allSites } = await db.from('websites').select('id').eq('active', true);
            for (const site of allSites) {
              await enqueueNotificationJob({
                websiteId: site.id,
                notificationPayload: payload
              });
            }
            bot.sendMessage(msg.chat.id, `✅ Enqueued notifications for all active websites (${allSites.length}).`);
          } else {
            await enqueueNotificationJob({
              websiteId: session.websiteId,
              notificationPayload: payload
            });
            bot.sendMessage(msg.chat.id, '✅ Enqueued notifications for the selected website.');
          }
        } catch (e) {
          console.error('Job error', e);
          bot.sendMessage(msg.chat.id, '❌ Failed to enqueue notifications.');
        }
        delete sessions[msg.chat.id];
      } else {
        bot.sendMessage(msg.chat.id, '❌ Campaign cancelled.');
        delete sessions[msg.chat.id];
      }
    }
  });

  const goToConfirm = (msg, session, bot) => {
    session.step = 'confirm';
    let summary = `📋 *Campaign Summary:*\n\n*Target:* ${session.targetType === 'all' ? 'All Websites' : 'Selected domain'}\n*Title:* ${session.title}\n*Body:* ${session.body}${session.url ? `\n*URL:* ${session.url}` : ''}`;
    
    if (session.actions && session.actions.length > 0) {
       summary += `\n*Buttons:* ${session.actions.map(a => `[${a.title}](${a.url})`).join(' | ')}`;
    }
    
    summary += `\n\nDo you want to send this broadcast?`;
    
    bot.sendMessage(msg.chat.id, summary, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Send Now', callback_data: 'confirm_yes' },
            { text: '❌ Cancel', callback_data: 'confirm_no' }
          ]
        ]
      }
    });
  };

  bot.on('message', (msg) => {
    if (!isAuthorized(msg)) return;
    if (msg.text && msg.text.startsWith('/')) return;
    
    const session = sessions[msg.chat.id];
    if (!session) return;
    
    if (session.step === 'await_title') {
      session.title = msg.text;
      session.step = 'await_body';
      bot.sendMessage(msg.chat.id, 'Step 3/6: Please send me the *Message Body* of the notification.', { parse_mode: 'Markdown' });
    }
    else if (session.step === 'await_body') {
      session.body = msg.text;
      session.step = 'await_url';
      bot.sendMessage(msg.chat.id, 'Step 4/6: Send me the *Click URL* (or type "skip" to send without a main URL).', { parse_mode: 'Markdown' });
    }
    else if (session.step === 'await_url') {
      if (msg.text.toLowerCase() !== 'skip') {
        session.url = msg.text;
      }
      session.actions = [];
      session.step = 'await_action1_title';
      bot.sendMessage(msg.chat.id, 'Step 5/6: Do you want to add an *Action Button 1*?\nSend its Title (or type "skip").', { parse_mode: 'Markdown' });
    }
    else if (session.step === 'await_action1_title') {
      if (msg.text.toLowerCase() === 'skip') {
        goToConfirm(msg, session, bot);
      } else {
        session.action1Title = msg.text;
        session.step = 'await_action1_url';
        bot.sendMessage(msg.chat.id, 'Send the *Click URL* for Button 1.', { parse_mode: 'Markdown' });
      }
    }
    else if (session.step === 'await_action1_url') {
      session.action1Url = msg.text;
      session.actions.push({ action: 'action_1', title: session.action1Title, url: session.action1Url });
      
      session.step = 'await_action2_title';
      bot.sendMessage(msg.chat.id, 'Step 6/6: Do you want to add *Action Button 2*?\nSend its Title (or type "skip").', { parse_mode: 'Markdown' });
    }
    else if (session.step === 'await_action2_title') {
      if (msg.text.toLowerCase() === 'skip') {
        goToConfirm(msg, session, bot);
      } else {
        session.action2Title = msg.text;
        session.step = 'await_action2_url';
        bot.sendMessage(msg.chat.id, 'Send the *Click URL* for Button 2.', { parse_mode: 'Markdown' });
      }
    }
    else if (session.step === 'await_action2_url') {
      session.action2Url = msg.text;
      session.actions.push({ action: 'action_2', title: session.action2Title, url: session.action2Url });
      goToConfirm(msg, session, bot);
    }
  });

  return bot;
}

module.exports = { setupTelegramBot };
