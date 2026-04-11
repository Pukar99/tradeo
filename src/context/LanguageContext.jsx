import { createContext, useContext, useState } from 'react'

const LanguageContext = createContext()

// Mixed Nepali-English (Nepanglish) translations
// Style: key terms stay English, labels/UI in Nepali
export const translations = {
  en: {
    // Nav
    nav: {
      home: 'Home', analysis: 'Analysis', trader: 'Trader',
      portfolio: 'Portfolio', research: 'Research', risklab: 'Risk Lab',
      login: 'Login', getStarted: 'Get Started',
      dashboard: 'Dashboard', profile: 'Profile', aiChat: 'AI Chat',
      tradeLog: 'Trade Log', logout: 'Logout',
    },
    // Home logged-out
    hero: {
      badge: 'Professional NEPSE Trading Workspace',
      headline: 'Built for traders who take',
      headlineAccent: 'discipline seriously.',
      sub: 'Tradeo is your all-in-one command center — from your first trade to your thousandth.',
      cta: 'Get Started — It\'s Free', ctaLogin: 'Login',
      feat1Title: 'Trade Journal', feat1Desc: 'Log every entry, exit, and lesson learned',
      feat2Title: 'Smart Watchlist', feat2Desc: 'Price & date alerts with BUY/SELL tags',
      feat3Title: 'Portfolio Tracker', feat3Desc: 'Unrealized P&L, positions, and exposure',
      feat4Title: 'Discipline Score', feat4Desc: 'Track consistency, habits, and streaks',
      feat5Title: 'Tradeo AI', feat5Desc: 'Ask anything about your trades & market',
      feat6Title: 'Risk Lab', feat6Desc: 'Position sizer, NEPSE calc, SIP planner',
    },
    // Dashboard stats
    stats: {
      totalPL: 'Total P/L Today', unrealized: 'Unrealized',
      winRate: 'Win Rate', openPositions: 'Open Positions',
      totalInvested: 'Total Invested',
    },
    // Watchlist
    watchlist: {
      title: 'Watchlist', active: 'Active', preWatch: 'Pre-Watch',
      portfolio: 'Portfolio', addStock: '+ Add Stock',
      noStocks: 'No stocks added', noPositions: 'No open positions',
      searchSymbol: 'Search symbol...', addToActive: '⭐ Active',
      addToPreWatch: '🟡 Pre-Watch', priceAlert: 'Price Alert',
      dateAlert: 'Date Alert', notes: 'Notes',
    },
    // Open positions
    positions: {
      title: 'Open Positions', expand: 'Expand', collapse: 'Collapse',
      noPositions: 'No open positions',
    },
    // Trader page
    trader: {
      title: 'Trade Log', subtitle: 'Record your trades with discipline & clarity',
      addTrade: '+ Add New Trade', searchSymbol: 'Search symbol...',
      all: 'ALL', open: 'OPEN', partial: 'PARTIAL', closed: 'CLOSED',
      noTrades: 'No trades yet', noTradesHint: 'Click \'+ Add New Trade\' to start recording',
      tabLog: '📊 Trade Log', tabJournal: '📝 Journal',
      totalTrades: 'Total', winners: 'Winners', totalPL: 'Total P&L',
    },
    // Portfolio
    portfolio: {
      loginRequired: 'Login Required',
      loginMsg: 'You need to login to access your Portfolio and holdings.',
    },
    // Auth guards shared
    auth: {
      loginBtn: 'Login', signupBtn: 'Sign Up',
    },
    // Tasks
    tasks: { title: "Today's Tasks", done: 'done', addTask: '+ Add task', dailyRoutine: 'Daily Routine', completed: 'Completed', addRoutine: 'Add Routine Log' },
    // Goals
    goals: {
      title: 'Monthly Goals', add: '+ Add Goal', cancel: 'Cancel',
      completed: 'completed', save: 'Save Goal', saving: 'Saving...',
      noGoals: 'No goals set for this month',
      noGoalsHint: 'Click "+ Add Goal" to set your monthly targets',
      titleLabel: 'Goal Title', descLabel: 'Description (optional)',
      dateLabel: 'Target Date (optional)',
    },
    // Discipline
    discipline: { title: 'Discipline Score' },
    // AI Chat
    chat: {
      placeholder: 'Ask anything about your trades...',
      online: 'Online', clear: 'Clear',
      greeting: 'How can I help you today?',
      greetingSub: 'Ask about your portfolio, NEPSE stocks, or trading strategies',
      loginToChat: 'Login to Chat',
    },
    // Morning briefing
    briefing: {
      greeting: 'Good morning', subtitle: 'Here\'s your trading brief for today',
      openTrades: 'Open Trades', watchAlerts: 'Watch Alerts',
      disciplineScore: 'Discipline Score', tasksDone: 'Tasks Done',
      riskAlerts: 'Risk Alerts', marketSnapshot: 'Market Snapshot',
      todaysFocus: 'Today\'s Focus', close: 'Start Trading',
    },
    // Risk Lab
    risklab: { title: 'Risk Lab', subtitle: 'Calculate before you trade — position sizing, NEPSE charges, performance analytics & SIP' },
    // Login/Signup
    loginPage: { title: 'Welcome back', sub: 'Login to your Tradeo account', btn: 'Login', noAccount: "Don't have an account?", signup: 'Sign up' },
    signupPage: { title: 'Create account', sub: 'Start your trading journey', btn: 'Create Account', hasAccount: 'Already have an account?', login: 'Login' },
  },

  ne: {
    // Nav
    nav: {
      home: 'होमपेज', analysis: 'विश्लेषण', trader: 'ट्रेडर',
      portfolio: 'पोर्टफोलियो', research: 'रिसर्च', risklab: 'Risk Lab',
      login: 'लगइन', getStarted: 'सुरु गर्नुस्',
      dashboard: 'ड्यासबोर्ड', profile: 'प्रोफाइल', aiChat: 'AI च्याट',
      tradeLog: 'Trade Log', logout: 'लगआउट',
    },
    // Home logged-out
    hero: {
      badge: 'Professional NEPSE Trading Workspace',
      headline: 'Discipline लाई गम्भीरतापूर्वक लिने',
      headlineAccent: 'Trader हरुका लागि।',
      sub: 'Tradeo — तपाईंको सम्पूर्ण NEPSE trading workspace। पहिलो trade देखि हजारौं सम्म।',
      cta: 'नि:शुल्क सुरु गर्नुस्', ctaLogin: 'लगइन',
      feat1Title: 'Trade Journal', feat1Desc: 'हरेक entry, exit र सिकाई रेकर्ड गर्नुस्',
      feat2Title: 'Smart Watchlist', feat2Desc: 'BUY/SELL alert सहित price र date tracking',
      feat3Title: 'Portfolio Tracker', feat3Desc: 'Unrealized P&L, positions र exposure हेर्नुस्',
      feat4Title: 'Discipline Score', feat4Desc: 'Consistency, बानी र streak track गर्नुस्',
      feat5Title: 'Tradeo AI', feat5Desc: 'Trade र market बारे जेसुकै सोध्नुस्',
      feat6Title: 'Risk Lab', feat6Desc: 'Position sizer, NEPSE calculator, SIP planner',
    },
    // Dashboard stats
    stats: {
      totalPL: 'आजको कुल P/L', unrealized: 'Unrealized',
      winRate: 'Win Rate', openPositions: 'खुला Positions',
      totalInvested: 'कुल लगानी',
    },
    // Watchlist
    watchlist: {
      title: 'Watchlist', active: 'सक्रिय', preWatch: 'Pre-Watch',
      portfolio: 'Portfolio', addStock: '+ Stock थप्नुस्',
      noStocks: 'कुनै stock थपिएको छैन', noPositions: 'खुला positions छैन',
      searchSymbol: 'Symbol खोज्नुस्...', addToActive: '⭐ Active',
      addToPreWatch: '🟡 Pre-Watch', priceAlert: 'मूल्य Alert',
      dateAlert: 'मिति Alert', notes: 'नोट्स',
    },
    // Open positions
    positions: {
      title: 'खुला Positions', expand: 'विस्तार', collapse: 'सङ्कुचित',
      noPositions: 'कुनै खुला position छैन',
    },
    // Trader page
    trader: {
      title: 'Trade Log', subtitle: 'Discipline र स्पष्टतासाथ trade रेकर्ड गर्नुस्',
      addTrade: '+ नयाँ Trade थप्नुस्', searchSymbol: 'Symbol खोज्नुस्...',
      all: 'सबै', open: 'खुला', partial: 'आंशिक', closed: 'बन्द',
      noTrades: 'अहिलेसम्म कुनै trade छैन', noTradesHint: '\'+ नयाँ Trade थप्नुस्\' मा क्लिक गर्नुस्',
      tabLog: '📊 Trade Log', tabJournal: '📝 Journal',
      totalTrades: 'कुल', winners: 'नाफामा', totalPL: 'कुल P&L',
    },
    // Portfolio
    portfolio: {
      loginRequired: 'लगइन आवश्यक छ',
      loginMsg: 'तपाईंको Portfolio र holdings हेर्न लगइन गर्नुहोस्।',
    },
    // Auth guards shared
    auth: {
      loginBtn: 'लगइन', signupBtn: 'साइनअप',
    },
    // Tasks
    tasks: { title: 'आजका कार्यहरू', done: 'सकियो', addTask: '+ कार्य थप्नुस्', dailyRoutine: 'दैनिक Routine', completed: 'पूरा भयो', addRoutine: 'Routine थप्नुस्' },
    // Goals
    goals: {
      title: 'मासिक लक्ष्यहरू', add: '+ लक्ष्य थप्नुस्', cancel: 'रद्द गर्नुस्',
      completed: 'पूरा भयो', save: 'लक्ष्य सेभ गर्नुस्', saving: 'सेभ हुँदैछ...',
      noGoals: 'यस महिनाको कुनै लक्ष्य छैन',
      noGoalsHint: '"+ लक्ष्य थप्नुस्" मा क्लिक गरेर लक्ष्य राख्नुस्',
      titleLabel: 'लक्ष्यको शीर्षक', descLabel: 'विवरण (वैकल्पिक)',
      dateLabel: 'लक्ष्य मिति (वैकल्पिक)',
    },
    // Discipline
    discipline: { title: 'Discipline Score' },
    // AI Chat
    chat: {
      placeholder: 'Trade वा market बारे जेसुकै सोध्नुस्...',
      online: 'Online', clear: 'मेट्नुस्',
      greeting: 'आज म कसरी सहयोग गर्न सक्छु?',
      greetingSub: 'Portfolio, NEPSE stocks वा trading strategies बारे सोध्नुस्',
      loginToChat: 'Chat गर्न लगइन गर्नुस्',
    },
    // Morning briefing
    briefing: {
      greeting: 'शुभप्रभात', subtitle: 'आजको trading brief तयार छ',
      openTrades: 'खुला Trades', watchAlerts: 'Watch Alerts',
      disciplineScore: 'Discipline Score', tasksDone: 'कार्य सकियो',
      riskAlerts: 'Risk Alerts', marketSnapshot: 'Market Snapshot',
      todaysFocus: 'आजको फोकस', close: 'Trading सुरु गर्नुस्',
    },
    // Risk Lab
    risklab: { title: 'Risk Lab', subtitle: 'NEPSE का लागि Professional trading calculators' },
    // Login/Signup
    loginPage: { title: 'स्वागत छ', sub: 'आफ्नो Tradeo account मा लगइन गर्नुस्', btn: 'लगइन', noAccount: 'Account छैन?', signup: 'साइनअप' },
    signupPage: { title: 'Account बनाउनुस्', sub: 'Trading यात्रा सुरु गर्नुस्', btn: 'Account बनाउनुस्', hasAccount: 'पहिले नै account छ?', login: 'लगइन' },
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'en')

  const toggleLang = () => {
    const next = lang === 'en' ? 'ne' : 'en'
    setLang(next)
    localStorage.setItem('lang', next)
  }

  const t = (path) => {
    const keys = path.split('.')
    let val = translations[lang]
    for (const k of keys) {
      val = val?.[k]
      if (val === undefined) return path
    }
    return val
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, isNepali: lang === 'ne' }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
