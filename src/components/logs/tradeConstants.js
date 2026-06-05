// Shared constants for trade log modals — emotional states, exit reasons, and their pill color maps.

export const EMOTIONAL_STATES = ['Confident', 'Calm', 'Anxious', 'Fearful', 'Greedy', 'FOMO', 'Neutral']

export const EXIT_REASONS = ['Target Hit', 'SL Hit', 'Manual Exit', 'Reversal Signal', 'Time Stop']

export const EMOTION_COLOR = {
  Confident:'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Calm:     'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Anxious:  'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Fearful:  'border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Greedy:   'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  FOMO:     'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  Neutral:  'border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

export const EXIT_REASON_COLOR = {
  'Target Hit':       'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'SL Hit':           'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  'Manual Exit':      'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'Reversal Signal':  'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  'Time Stop':        'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
}
