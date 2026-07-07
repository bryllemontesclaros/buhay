// Extracted pure helper functions and constants from Lakas.jsx
// These are stateless — no React hooks, no JSX, no CSS module references.
import { formatDisplayDate, today } from './utils'

export function getWeeklyScore(workouts, habits, weekIndex = 0) {
  const now = new Date()
  const startMs = now.getTime() - (weekIndex * 7 + 7) * 24 * 60 * 60 * 1000
  const endMs = now.getTime() - (weekIndex * 7) * 24 * 60 * 60 * 1000

  const formatDate = d => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const startDateStr = formatDate(new Date(startMs))
  const endDateStr = formatDate(new Date(endMs))

  const weekWorkouts = workouts.filter(w => w.date > startDateStr && w.date <= endDateStr)
  const weekHabits = habits.filter(h => h.date > startDateStr && h.date <= endDateStr)

  const workoutsPoints = weekWorkouts.length * 10
  const habitsPoints = weekHabits.reduce((sum, h) => sum + (Number(h.score) || 0), 0) * 2
  const runDist = weekWorkouts.reduce((sum, w) => sum + (Number(w.distance) || 0), 0)
  const runPoints = Math.round(runDist * 3)

  const score = workoutsPoints + habitsPoints + runPoints

  return {
    score,
    workoutsCount: weekWorkouts.length,
    habitsCount: weekHabits.length,
    runDist,
    label: weekIndex === 0 ? 'This Week' : `Week -${weekIndex}`,
  }
}

export const FOOD_PRESETS = [
  { name: 'White rice (1 cup)', calories: 205, protein: 4, carbs: 45, fat: 0 },
  { name: 'Chicken adobo', calories: 320, protein: 28, carbs: 6, fat: 20 },
  { name: 'Boiled egg', calories: 78, protein: 6, carbs: 1, fat: 5 },
  { name: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: 'Chicken breast 150g', calories: 248, protein: 46, carbs: 0, fat: 5 },
  { name: 'Tuna flakes', calories: 180, protein: 24, carbs: 2, fat: 8 },
  { name: 'Pancit serving', calories: 350, protein: 12, carbs: 52, fat: 11 },
  { name: 'Milk tea regular', calories: 420, protein: 5, carbs: 70, fat: 12 },
]

export const RECOMP_STARTER_RULES = [
  'Train 3 days per week before adding more days.',
  'Keep 2-3 reps in reserve on every set for the first month.',
  'Add reps before adding weight.',
  'Keep daily walking high so fat loss happens without crash dieting.',
]

export const RECOMP_NUTRITION_GUIDE = {
  title: 'Recomp nutrition',
  body: 'If you feel under-muscled but softer around the waist, the goal is to eat enough to recover and build while keeping intake tight enough that body fat does not climb.',
  habits: [
    'Build every meal around protein first.',
    'Use maintenance calories or only a small deficit, not a hard cut.',
    'Keep rice and carbs around training instead of removing them completely.',
    'Save treats for portions you can repeat, not all-or-nothing cheat days.',
  ],
  meals: [
    'Breakfast: eggs + rice + fruit',
    'Lunch: chicken, fish, or lean pork + rice + vegetables',
    'Dinner: protein + vegetables + rice or potatoes',
    'Snack: yogurt, milk, tuna, eggs, or whey if available',
  ],
}

export const BEGINNER_PHASES = [
  {
    title: 'Weeks 1-2: Learn the moves',
    desc: 'Use light effort, stop 2-3 reps before failure, and focus on smooth pain-free range of motion.',
  },
  {
    title: 'Weeks 3-4: Add one small step',
    desc: 'Add 1-2 reps per set or one extra set only when form still looks controlled.',
  },
  {
    title: 'Weeks 5-8: Build consistency',
    desc: 'Add a little weight only after you can finish all reps twice with clean form and normal recovery.',
  },
]

export const FORM_GUIDES = [
  {
    match: ['squat', 'goblet squat', 'bodyweight squat'],
    name: 'Squat',
    setup: 'Feet about shoulder-width, ribs down, brace like someone will poke your stomach.',
    execution: 'Sit between your hips, keep knees tracking over toes, stand by pushing the floor away.',
    mistakes: 'Knees collapsing inward, heels lifting, rushing the bottom, or loading heavy before depth feels stable.',
    safety: 'Stop if you feel sharp knee, hip, or back pain. Reduce depth or use a box squat.',
  },
  {
    match: ['push-up', 'push up', 'bench press', 'incline dumbbell press'],
    name: 'Pressing',
    setup: 'Shoulder blades gently back/down, wrists stacked, elbows around 30-60 degrees from the body.',
    execution: 'Lower with control, pause lightly, press without shrugging or bouncing.',
    mistakes: 'Flaring elbows hard, losing wrist stack, bouncing off the chest, or arching aggressively.',
    safety: 'Use incline push-ups or lighter dumbbells if shoulders feel pinchy.',
  },
  {
    match: ['row', 'barbell row', 'dumbbell row', 'lat pulldown', 'face pull'],
    name: 'Pulling',
    setup: 'Start tall or hinged with a braced trunk. Let the shoulder blade move, then pull the elbow.',
    execution: 'Pull toward ribs or chest, pause briefly, lower slowly without yanking.',
    mistakes: 'Using momentum, craning the neck, shrugging every rep, or turning rows into lower-back swings.',
    safety: 'Lower the load if you cannot keep your ribs and neck quiet.',
  },
  {
    match: ['romanian deadlift', 'deadlift', 'glute bridge'],
    name: 'Hip hinge',
    setup: 'Soft knees, brace, then push hips back like closing a car door.',
    execution: 'Keep weight close, feel hamstrings/glutes, stand tall without leaning back.',
    mistakes: 'Rounding the back, squatting the hinge, letting weight drift forward, or chasing too much range.',
    safety: 'Stop above the point where your back wants to round.',
  },
  {
    match: ['plank', 'dead bug'],
    name: 'Core control',
    setup: 'Ribs down, glutes lightly squeezed, breathe through the brace.',
    execution: 'Hold tension without shaking the lower back into an arch.',
    mistakes: 'Holding breath, sagging hips, neck strain, or turning every rep into speed work.',
    safety: 'Shorten the set when form changes. Quality beats time.',
  },
]

export const GYM_SESSION_TYPES = [
  {
    key: 'beginner',
    label: 'Beginner program',
    templateName: '',
    desc: 'Adaptive starter program based on your workout place and equipment.',
  },
  {
    key: 'push',
    label: 'Push day',
    templateName: 'Push Day',
    desc: 'Chest, shoulders, and triceps.',
  },
  {
    key: 'pull',
    label: 'Pull day',
    templateName: 'Pull Day',
    desc: 'Back, rear delts, and biceps.',
  },
  {
    key: 'legs',
    label: 'Leg day',
    templateName: 'Leg Day',
    desc: 'Quads, glutes, hamstrings, and calves.',
  },
  {
    key: 'full-body',
    label: 'Full body',
    templateName: 'Full Body',
    desc: 'Simple all-around session for busy days.',
  },
  {
    key: 'home',
    label: 'Home workout',
    templateName: 'Home Workout',
    desc: 'No-equipment or low-equipment session for home days.',
  },
  {
    key: 'cardio',
    label: 'Cardio',
    templateName: 'Cardio Base',
    desc: 'Easy conditioning before chasing speed.',
  },
  {
    key: 'running',
    label: 'Outdoor Run',
    templateName: 'Outdoor Run',
    desc: 'Starts real-time GPS tracking and maps your running route.',
    isRunMode: true,
  },
  {
    key: 'recovery',
    label: 'Recovery',
    templateName: 'Recovery Flow',
    desc: 'Light reset day for movement, mobility, and recovery.',
  },
]

export const EXERCISE_VIDEO_GUIDES = [
  {
    match: ['bodyweight squat', 'goblet squat', 'squat', 'leg press'],
    id: '6AAqJyUDTnk',
    title: 'Goblet squat form guide',
  },
  {
    match: ['incline push-up', 'push-up', 'push up'],
    id: 'y8I66lWtNB8',
    title: 'Incline push-up form',
  },
  {
    match: ['dumbbell row', 'barbell row', 'row', 'face pull'],
    id: 'ufhQhwyrx-4',
    title: 'Row form tutorial',
  },
  {
    match: ['dead bug', 'plank'],
    id: '4XLEnwUr1d8',
    title: 'Core form tutorial',
  },
  {
    match: ['bench press', 'incline dumbbell press'],
    id: 'Qjxrp9Hwv_Q',
    title: 'Bench press exercise guide',
  },
  {
    match: ['shoulder press'],
    id: '0JfYxMRsUCQ',
    title: 'Dumbbell shoulder press guide',
  },
  {
    match: ['triceps pushdown'],
    id: '_w-HpW70nSQ',
    title: 'Cable triceps pushdown guide',
  },
  {
    match: ['lat pulldown'],
    id: 'lueEJGjTuPQ',
    title: 'Lat pulldown exercise guide',
  },
  {
    match: ['romanian deadlift', 'deadlift', 'glute bridge'],
    id: 'CQp5I9KgdXI',
    title: 'Hip hinge form',
  },
  {
    match: ['dumbbell curl', 'curl', 'bicep'],
    id: '3OZ2MT_5r3Q',
    title: 'Dumbbell curl exercise guide',
  },
  {
    match: ['calf raise'],
    id: 'wxwY7GXxL4k',
    title: 'Standing calf raise guide',
  },
  {
    match: ['brisk walk', 'walk', 'treadmill'],
    id: '09LAB5ErEfo',
    title: 'Walking form',
  },
]

export const BUILT_IN_ROUTINES = [
  {
    name: 'Beginner Foundation A',
    focus: 'Beginner',
    difficulty: 'Beginner',
    weeks: 'Weeks 1-2',
    duration: 28,
    progression: 'When every set feels clean twice, add 1 rep per set next time.',
    deload: 'If form breaks or soreness lasts more than 48 hours, repeat the same numbers or remove one set.',
    notes: 'A safe first gym or home session. Move slowly, leave 2-3 reps in reserve, and do not chase failure.',
    exercises: [
      { name: 'Bodyweight squat', sets: 2, reps: 8, weight: 0, duration: 0, rest: 90, notes: 'Slow down, stand tall, knees track over toes' },
      { name: 'Incline push-up', sets: 2, reps: 6, weight: 0, duration: 0, rest: 90, notes: 'Hands on bench/table; body straight' },
      { name: 'Dumbbell row', sets: 2, reps: 8, weight: 0, duration: 0, rest: 90, notes: 'Pull elbow toward ribs' },
      { name: 'Dead bug', sets: 2, reps: 8, weight: 0, duration: 0, rest: 60, notes: 'Keep lower back quiet' },
    ],
  },
  {
    name: 'Beginner Foundation B',
    focus: 'Beginner',
    difficulty: 'Beginner',
    weeks: 'Weeks 1-2',
    duration: 30,
    progression: 'Add one set only after the whole workout feels easy and controlled.',
    deload: 'If joints feel irritated, switch to walking and mobility for the day.',
    notes: 'Alternate this with Foundation A. Keep effort light enough that you could talk between sets.',
    exercises: [
      { name: 'Glute bridge', sets: 2, reps: 10, weight: 0, duration: 0, rest: 75, notes: 'Squeeze glutes, avoid lower-back arch' },
      { name: 'Goblet squat', sets: 2, reps: 8, weight: 0, duration: 0, rest: 90, notes: 'Use light weight or bodyweight' },
      { name: 'Lat pulldown', sets: 2, reps: 10, weight: 0, duration: 0, rest: 90, notes: 'Pull elbows down, no swinging' },
      { name: 'Brisk walk', sets: 1, reps: 0, weight: 0, duration: 600, rest: 0, notes: 'Easy pace, nasal breathing if possible' },
    ],
  },
  {
    name: 'Beginner Home A',
    focus: 'Beginner',
    difficulty: 'Beginner',
    weeks: 'Weeks 1-2',
    duration: 24,
    progression: 'Add 1-2 reps only after the whole session feels easy and controlled.',
    deload: 'If joints or low back feel irritated, shorten range, slow down, or walk instead.',
    notes: 'Home-first foundation session. Use bodyweight or a very light dumbbell only if form stays clean.',
    exercises: [
      { name: 'Bodyweight squat', sets: 2, reps: 8, weight: 0, duration: 0, rest: 75, notes: 'Use a chair or box if depth feels shaky' },
      { name: 'Incline push-up', sets: 2, reps: 6, weight: 0, duration: 0, rest: 75, notes: 'Hands on couch, table, or counter' },
      { name: 'Glute bridge', sets: 2, reps: 10, weight: 0, duration: 0, rest: 60, notes: 'Squeeze glutes, keep ribs down' },
      { name: 'Dead bug', sets: 2, reps: 8, weight: 0, duration: 0, rest: 45, notes: 'Slow control before longer sets' },
    ],
  },
  {
    name: 'Beginner Home B',
    focus: 'Beginner',
    difficulty: 'Beginner',
    weeks: 'Weeks 1-2',
    duration: 26,
    progression: 'Repeat the same session until breathing and recovery feel normal, then add 1 rep per set.',
    deload: 'If fatigue lingers, keep reps the same and shorten the walk.',
    notes: 'Alternate this with Beginner Home A. Keep the pace easy enough that you can still speak in short sentences.',
    exercises: [
      { name: 'Bodyweight squat', sets: 2, reps: 10, weight: 0, duration: 0, rest: 75, notes: 'Slow lowering, stand tall' },
      { name: 'Push-up', sets: 2, reps: 5, weight: 0, duration: 0, rest: 75, notes: 'Use incline if flat floor reps are not clean yet' },
      { name: 'Dead bug', sets: 2, reps: 10, weight: 0, duration: 0, rest: 45, notes: 'Exhale as the leg reaches out' },
      { name: 'Brisk walk', sets: 1, reps: 0, weight: 0, duration: 480, rest: 0, notes: 'Easy pace around home or outdoors' },
    ],
  },
  {
    name: 'Recomp Starter A',
    focus: 'Beginner',
    difficulty: 'Beginner',
    weeks: 'Weeks 1-4',
    duration: 38,
    progression: 'Once all sets feel clean twice, add 1 rep per set before adding any load.',
    deload: 'If recovery feels poor, repeat the same numbers or remove the final set from each lift for one week.',
    notes: 'For low muscle mass with extra waist fat. Build muscle first, keep effort controlled, and finish with easy cardio.',
    exercises: [
      { name: 'Goblet squat', sets: 3, reps: 8, weight: 0, duration: 0, rest: 90, notes: 'Controlled depth; stop before form shifts' },
      { name: 'Incline push-up', sets: 3, reps: 8, weight: 0, duration: 0, rest: 75, notes: 'Use a bench or rail height that keeps reps clean' },
      { name: 'Lat pulldown', sets: 3, reps: 10, weight: 0, duration: 0, rest: 90, notes: 'Pull elbows toward ribs; no swinging' },
      { name: 'Romanian deadlift', sets: 2, reps: 8, weight: 0, duration: 0, rest: 105, notes: 'Light hinge; stop before lower-back rounding' },
      { name: 'Brisk walk', sets: 1, reps: 0, weight: 0, duration: 600, rest: 0, notes: 'Finish with 10 easy minutes' },
    ],
  },
  {
    name: 'Recomp Starter B',
    focus: 'Beginner',
    difficulty: 'Beginner',
    weeks: 'Weeks 1-4',
    duration: 40,
    progression: 'Keep the same load until you can finish all reps twice with clean tempo, then increase slightly.',
    deload: 'If soreness lingers past two days, shorten one set from the lower-body work and keep the walk easy.',
    notes: 'Second alternating day for recomposition. The goal is repeatable training, not exhaustion.',
    exercises: [
      { name: 'Leg press', sets: 3, reps: 10, weight: 0, duration: 0, rest: 90, notes: 'Use a load you could clearly do for 2-3 more reps' },
      { name: 'Shoulder press', sets: 3, reps: 8, weight: 0, duration: 0, rest: 75, notes: 'Light dumbbells and smooth lockout' },
      { name: 'Dumbbell row', sets: 3, reps: 10, weight: 0, duration: 0, rest: 75, notes: 'Pause briefly at the top' },
      { name: 'Glute bridge', sets: 2, reps: 12, weight: 0, duration: 0, rest: 60, notes: 'Keep ribs down and squeeze glutes' },
      { name: 'Dead bug', sets: 2, reps: 8, weight: 0, duration: 0, rest: 45, notes: 'Slow reps; keep lower back quiet' },
    ],
  },
  {
    name: 'Recomp Home A',
    focus: 'Beginner',
    difficulty: 'Beginner',
    weeks: 'Weeks 1-4',
    duration: 32,
    progression: 'Add reps first. Only add load from a backpack or dumbbells after two easy, clean sessions.',
    deload: 'If recovery drops, repeat the same session and shorten the walk instead of forcing more reps.',
    notes: 'Home-first recomposition program. Keep the barrier low and the pace steady.',
    exercises: [
      { name: 'Bodyweight squat', sets: 3, reps: 10, weight: 0, duration: 0, rest: 75, notes: 'Use a chair if balance or depth feels shaky' },
      { name: 'Incline push-up', sets: 3, reps: 8, weight: 0, duration: 0, rest: 75, notes: 'Counter, table, or couch works' },
      { name: 'Dumbbell row', sets: 3, reps: 10, weight: 0, duration: 0, rest: 75, notes: 'Backpack row also works' },
      { name: 'Glute bridge', sets: 2, reps: 12, weight: 0, duration: 0, rest: 60, notes: 'Pause at the top' },
      { name: 'Brisk walk', sets: 1, reps: 0, weight: 0, duration: 600, rest: 0, notes: 'Easy pace; keep it repeatable' },
    ],
  },
  {
    name: 'Recomp Home B',
    focus: 'Beginner',
    difficulty: 'Beginner',
    weeks: 'Weeks 1-4',
    duration: 34,
    progression: 'Build to the top of the rep range first, then add a little difficulty or load.',
    deload: 'If joints feel irritated, shorten the range and slow the reps instead of quitting the habit.',
    notes: 'Second home day for under-muscled beginners who want to tighten up without crashing calories.',
    exercises: [
      { name: 'Goblet squat', sets: 3, reps: 8, weight: 0, duration: 0, rest: 75, notes: 'Backpack or dumbbell optional' },
      { name: 'Push-up', sets: 2, reps: 6, weight: 0, duration: 0, rest: 75, notes: 'Use incline if floor reps are not clean yet' },
      { name: 'Glute bridge', sets: 3, reps: 12, weight: 0, duration: 0, rest: 60, notes: 'Smooth reps only' },
      { name: 'Dead bug', sets: 2, reps: 10, weight: 0, duration: 0, rest: 45, notes: 'Exhale and brace every rep' },
      { name: 'Brisk walk', sets: 1, reps: 0, weight: 0, duration: 720, rest: 0, notes: '12 easy minutes' },
    ],
  },
  {
    name: 'Push Day',
    focus: 'Hypertrophy',
    duration: 60,
    notes: 'Chest, shoulders, triceps. Add weight only when reps stay clean.',
    exercises: [
      { name: 'Bench press', sets: 4, reps: 8, weight: 0, duration: 0, rest: 120, notes: '' },
      { name: 'Shoulder press', sets: 3, reps: 10, weight: 0, duration: 0, rest: 90, notes: '' },
      { name: 'Incline dumbbell press', sets: 3, reps: 10, weight: 0, duration: 0, rest: 90, notes: '' },
      { name: 'Triceps pushdown', sets: 3, reps: 12, weight: 0, duration: 0, rest: 60, notes: '' },
    ],
  },
  {
    name: 'Pull Day',
    focus: 'Strength',
    duration: 60,
    notes: 'Back and biceps. Keep shoulder blades controlled.',
    exercises: [
      { name: 'Lat pulldown', sets: 4, reps: 10, weight: 0, duration: 0, rest: 90, notes: '' },
      { name: 'Barbell row', sets: 4, reps: 8, weight: 0, duration: 0, rest: 120, notes: '' },
      { name: 'Face pull', sets: 3, reps: 15, weight: 0, duration: 0, rest: 60, notes: '' },
      { name: 'Dumbbell curl', sets: 3, reps: 12, weight: 0, duration: 0, rest: 60, notes: '' },
    ],
  },
  {
    name: 'Leg Day',
    focus: 'Strength',
    duration: 65,
    notes: 'Lower body day. Warm up knees and hips before heavy sets.',
    exercises: [
      { name: 'Squat', sets: 4, reps: 6, weight: 0, duration: 0, rest: 150, notes: '' },
      { name: 'Romanian deadlift', sets: 3, reps: 8, weight: 0, duration: 0, rest: 120, notes: '' },
      { name: 'Leg press', sets: 3, reps: 12, weight: 0, duration: 0, rest: 90, notes: '' },
      { name: 'Calf raise', sets: 4, reps: 15, weight: 0, duration: 0, rest: 60, notes: '' },
    ],
  },
  {
    name: 'Full Body',
    focus: 'Conditioning',
    duration: 45,
    notes: 'Simple whole-body plan for busy days.',
    exercises: [
      { name: 'Goblet squat', sets: 3, reps: 12, weight: 0, duration: 0, rest: 75, notes: '' },
      { name: 'Push-up', sets: 3, reps: 12, weight: 0, duration: 0, rest: 60, notes: '' },
      { name: 'Dumbbell row', sets: 3, reps: 10, weight: 0, duration: 0, rest: 75, notes: '' },
      { name: 'Plank', sets: 3, reps: 0, weight: 0, duration: 45, rest: 45, notes: '' },
    ],
  },
  {
    name: 'Home Workout',
    focus: 'Mobility',
    duration: 30,
    notes: 'No equipment needed.',
    exercises: [
      { name: 'Bodyweight squat', sets: 3, reps: 15, weight: 0, duration: 0, rest: 45, notes: '' },
      { name: 'Push-up', sets: 3, reps: 10, weight: 0, duration: 0, rest: 45, notes: '' },
      { name: 'Glute bridge', sets: 3, reps: 15, weight: 0, duration: 0, rest: 45, notes: '' },
      { name: 'Dead bug', sets: 3, reps: 12, weight: 0, duration: 0, rest: 30, notes: '' },
    ],
  },
  {
    name: 'Cardio Base',
    focus: 'Cardio',
    duration: 35,
    notes: 'Easy pace. Build consistency before speed.',
    exercises: [
      { name: 'Brisk walk', sets: 1, reps: 0, weight: 0, duration: 1800, rest: 0, notes: 'Zone 2 pace' },
      { name: 'Cool down stretch', sets: 1, reps: 0, weight: 0, duration: 300, rest: 0, notes: '' },
    ],
  },
  {
    name: 'Recovery Flow',
    focus: 'Mobility',
    duration: 20,
    notes: 'Use this on low-energy days to keep the habit without forcing intensity.',
    exercises: [
      { name: 'Brisk walk', sets: 1, reps: 0, weight: 0, duration: 480, rest: 0, notes: 'Easy pace to warm up' },
      { name: 'Glute bridge', sets: 2, reps: 10, weight: 0, duration: 0, rest: 45, notes: 'Smooth reps only' },
      { name: 'Dead bug', sets: 2, reps: 8, weight: 0, duration: 0, rest: 45, notes: 'Quiet lower back and slow breathing' },
      { name: 'Cool down stretch', sets: 1, reps: 0, weight: 0, duration: 300, rest: 0, notes: 'Stay gentle and stop if anything feels sharp' },
    ],
  },
]

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
export const GOAL_TYPES = ['Workout', 'Weight', 'Calories', 'Protein', 'Steps', 'Body', 'Habit', 'Custom']
export const ROUTINE_FOCUS = ['Beginner', 'Strength', 'Hypertrophy', 'Cardio', 'Mobility', 'Conditioning', 'Custom']
export const ACTIVITY_TYPES = ['Walk', 'Run', 'Cardio', 'Cycling', 'Sport', 'Active day']
export const REMINDER_TYPES = ['Workout', 'Weigh-in', 'Rest day', 'Steps', 'Habit', 'Meal prep']
export const REMINDER_FREQUENCIES = ['once', 'daily', 'weekly', 'monthly']
export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const ROUTINE_LIBRARY_META = {
  'Starter programs': 'Simple beginner-first sessions for building confidence and consistency.',
  'Gym routines': 'Push, pull, legs, and full-body templates for structured gym days.',
  'Home & travel': 'Low-equipment options for home weeks, travel days, or backup training.',
  'Cardio & recovery': 'Lower-intensity sessions for conditioning, mobility, and reset days.',
  General: 'Saved routines that do not fit a preset group yet.',
}

export const EXERCISE_LIBRARY_CATEGORIES = ['Strength', 'Cardio', 'Mobility', 'Recovery']
export const EXERCISE_MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Core',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Full body',
  'Cardio',
]

export const DEFAULT_EXERCISE_LIBRARY = [
  { name: 'Barbell row', category: 'Strength', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
  { name: 'Bench press', category: 'Strength', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },
  { name: 'Bodyweight squat', category: 'Strength', primaryMuscle: 'Quads', secondaryMuscles: ['Glutes', 'Core'] },
  { name: 'Brisk walk', category: 'Cardio', primaryMuscle: 'Cardio', secondaryMuscles: ['Calves'] },
  { name: 'Calf raise', category: 'Strength', primaryMuscle: 'Calves', secondaryMuscles: [] },
  { name: 'Cool down stretch', category: 'Recovery', primaryMuscle: 'Full body', secondaryMuscles: [] },
  { name: 'Dead bug', category: 'Mobility', primaryMuscle: 'Core', secondaryMuscles: [] },
  { name: 'Dumbbell curl', category: 'Strength', primaryMuscle: 'Biceps', secondaryMuscles: [] },
  { name: 'Dumbbell row', category: 'Strength', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
  { name: 'Face pull', category: 'Strength', primaryMuscle: 'Shoulders', secondaryMuscles: ['Back'] },
  { name: 'Glute bridge', category: 'Strength', primaryMuscle: 'Glutes', secondaryMuscles: ['Hamstrings'] },
  { name: 'Goblet squat', category: 'Strength', primaryMuscle: 'Quads', secondaryMuscles: ['Glutes', 'Core'] },
  { name: 'Incline dumbbell press', category: 'Strength', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },
  { name: 'Incline push-up', category: 'Strength', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },
  { name: 'Lat pulldown', category: 'Strength', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
  { name: 'Leg press', category: 'Strength', primaryMuscle: 'Quads', secondaryMuscles: ['Glutes'] },
  { name: 'Plank', category: 'Mobility', primaryMuscle: 'Core', secondaryMuscles: [] },
  { name: 'Push-up', category: 'Strength', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },
  { name: 'Romanian deadlift', category: 'Strength', primaryMuscle: 'Hamstrings', secondaryMuscles: ['Glutes', 'Back'] },
  { name: 'Shoulder press', category: 'Strength', primaryMuscle: 'Shoulders', secondaryMuscles: ['Triceps'] },
  { name: 'Triceps pushdown', category: 'Strength', primaryMuscle: 'Triceps', secondaryMuscles: [] },
]

export const HABIT_OPTIONS = [
  { key: 'water', label: 'Water' },
  { key: 'protein', label: 'Protein' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'stretching', label: 'Stretching' },
  { key: 'restDay', label: 'Rest day' },
  { key: 'vitamins', label: 'Vitamins' },
]

export const DEFAULT_LAKAS_SETTINGS = {
  units: {
    weight: 'kg',
    body: 'cm',
    distance: 'km',
  },
  targets: {
    steps: 8000,
    calories: 2200,
    protein: 120,
    water: 8,
    sleep: 7,
    workoutsPerWeek: 3,
  },
  workoutDefaults: {
    sets: 3,
    reps: 10,
    restSeconds: 90,
    durationMinutes: 60,
  },
  training: {
    experienceLevel: 'Beginner',
    progressionMode: 'Guided',
  },
  baseline: {
    goal: 'Build consistency',
    workoutPlace: 'Gym',
    equipment: 'Full gym',
    limitations: '',
    currentWeight: 0,
    height: 0,
    bodyBaselineCreated: false,
  },
  meals: {
    calorieGoal: 2200,
    proteinGoal: 120,
    macroStyle: 'Balanced',
  },
  reminders: {
    workoutTime: '08:00',
    weighInDay: 'Monday',
    frequency: 'weekly',
  },
  display: {
    showBmi: true,
    hideProgressPhotosInPrivacy: true,
  },
  exerciseLibrary: [],
}

export const LAKAS_TAB_COPY = {
  workout: {
    eyebrow: 'Workout',
    title: 'Choose a program and start.',
    sub: 'Pick one guided workout, then log what actually happened.',
    guide: ['Choose a program', 'Start the workout', 'Log the real work'],
  },
  body: {
    eyebrow: 'Body & nutrition',
    title: 'Keep everyday health logs together.',
    sub: 'Meals and body check-ins stay closest, while movement, recovery, and longer-term goals remain nearby without blocking the everyday actions.',
    guide: ['Open the common log', 'Save the real entry', 'Keep goals nearby'],
  },
  progress: {
    eyebrow: 'Progress',
    title: 'Review the trend after the work is done.',
    sub: 'The most useful review surfaces stay visible first, while deeper charts and longer-term rollups open only when you need them.',
    guide: ['Check records', 'Spot the weekly trend', 'Open deeper review only when needed'],
  },
  settings: {
    eyebrow: 'Lakas settings',
    title: 'Keep Lakas practical, safe, and easy to return to.',
    sub: 'Core settings stay up front, while training profile and advanced defaults stay tucked away until you actually need them.',
    guide: ['Set basics', 'Adjust defaults', 'Protect your data'],
  },
}

export const LAKAS_TRACK_VIEWS = [
  { id: 'body', label: 'Body', meta: 'Measurements and weight' },
  { id: 'activity', label: 'Movement', meta: 'Steps and active minutes' },
  { id: 'recovery', label: 'Recovery', meta: 'Habits and check-ins' },
]

export const VALID_LAKAS_TRACK_VIEWS = new Set(['body', 'activity', 'recovery', 'goals'])

export function getTrackViewForTab(tab = '') {
  if (tab === 'measurements' || tab === 'body-log') return 'body'
  if (tab === 'activity') return 'activity'
  if (tab === 'habits' || tab === 'recovery') return 'recovery'
  if (tab === 'goals') return 'goals'
  return 'body'
}

export function normalizeTrackView(view = '', activeTab = '') {
  return VALID_LAKAS_TRACK_VIEWS.has(view) ? view : getTrackViewForTab(activeTab)
}

export function createExerciseRow(overrides = {}, defaults = {}) {
  return {
    rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    sets: String(defaults.sets ?? '3'),
    reps: String(defaults.reps ?? '10'),
    weight: '',
    duration: '',
    rest: String(defaults.restSeconds ?? '90'),
    notes: '',
    ...overrides,
  }
}

export function createWorkoutForm(settings = DEFAULT_LAKAS_SETTINGS) {
  return {
    routineId: '',
    date: today(),
    title: '',
    duration: settings.workoutDefaults?.durationMinutes ? String(settings.workoutDefaults.durationMinutes) : '',
    exercises: [createExerciseRow({}, settings.workoutDefaults)],
    notes: '',
  }
}

export function createRoutineForm(settings = DEFAULT_LAKAS_SETTINGS) {
  return {
    name: '',
    focus: 'Strength',
    duration: settings.workoutDefaults?.durationMinutes ? String(settings.workoutDefaults.durationMinutes) : '',
    exercises: [createExerciseRow({}, settings.workoutDefaults)],
    notes: '',
  }
}

export function createMealForm() {
  return {
    date: today(),
    mealType: 'Lunch',
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    notes: '',
  }
}

export function getMediaSaveErrorMessage(error, kind = 'photo') {
  const code = String(error?.code || '')

  if (code === 'storage/unauthorized') {
    return `${kind === 'photo' ? 'Photo upload' : 'Image upload'} was blocked. If you just changed Vercel or App Check settings, redeploy first, then try again.`
  }

  if (code === 'storage/canceled') {
    return `${kind === 'photo' ? 'Photo upload' : 'Image upload'} was canceled before it finished.`
  }

  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
    return `Upload failed before saving. Try a smaller image. If you are testing the deployed app, redeploy first so the latest Storage fix is live.`
  }

  return `Check your connection and try again.`
}

export function isRetryableMediaSaveError(error) {
  const code = String(error?.code || '')
  return code === 'storage/retry-limit-exceeded' || code === 'storage/unknown'
}

export function createBodyForm() {
  return {
    date: today(),
    weight: '',
    height: '',
    waist: '',
    chest: '',
    hips: '',
    arm: '',
    thigh: '',
    notes: '',
  }
}

export function createActivityForm() {
  return {
    date: today(),
    type: 'Walk',
    steps: '',
    walkingMinutes: '',
    cardioMinutes: '',
    activeMinutes: '',
    distance: '',
    notes: '',
  }
}

export function createHabitForm() {
  return {
    date: today(),
    water: false,
    waterGlasses: 0,
    protein: false,
    sleep: false,
    stretching: false,
    restDay: false,
    vitamins: false,
    notes: '',
  }
}

export function createGoalForm() {
  return {
    name: '',
    type: 'Workout',
    target: '',
    current: '',
    unit: 'sessions',
  }
}

export function createExerciseLibraryDraft() {
  return {
    name: '',
    category: 'Strength',
    primaryMuscle: 'Full body',
    secondaryMuscles: '',
  }
}

export function createReminderForm(settings = DEFAULT_LAKAS_SETTINGS) {
  return {
    title: '',
    type: 'Workout',
    date: today(),
    time: settings.reminders?.workoutTime || '08:00',
    frequency: settings.reminders?.frequency || 'weekly',
    notes: '',
  }
}

export function getLakasSettings(profile = {}) {
  const settings = profile?.lakasSettings || {}
  return {
    units: { ...DEFAULT_LAKAS_SETTINGS.units, ...(settings.units || {}) },
    targets: { ...DEFAULT_LAKAS_SETTINGS.targets, ...(settings.targets || {}) },
    workoutDefaults: { ...DEFAULT_LAKAS_SETTINGS.workoutDefaults, ...(settings.workoutDefaults || {}) },
    training: { ...DEFAULT_LAKAS_SETTINGS.training, ...(settings.training || {}) },
    baseline: { ...DEFAULT_LAKAS_SETTINGS.baseline, ...(settings.baseline || {}) },
    meals: { ...DEFAULT_LAKAS_SETTINGS.meals, ...(settings.meals || {}) },
    reminders: { ...DEFAULT_LAKAS_SETTINGS.reminders, ...(settings.reminders || {}) },
    display: { ...DEFAULT_LAKAS_SETTINGS.display, ...(settings.display || {}) },
    exerciseLibrary: sanitizeExerciseLibrary(settings.exerciseLibrary || []),
    mealCombos: settings.mealCombos || [],
  }
}

export function sanitizeLakasSettings(settings = {}) {
  const next = getLakasSettings({ lakasSettings: settings })
  return {
    units: {
      weight: next.units.weight === 'lb' ? 'lb' : 'kg',
      body: next.units.body === 'in' ? 'in' : 'cm',
      distance: next.units.distance === 'mi' ? 'mi' : 'km',
    },
    targets: {
      steps: numberOrZero(next.targets.steps),
      calories: numberOrZero(next.targets.calories),
      protein: numberOrZero(next.targets.protein),
      water: numberOrZero(next.targets.water),
      sleep: numberOrZero(next.targets.sleep),
      workoutsPerWeek: numberOrZero(next.targets.workoutsPerWeek),
    },
    workoutDefaults: {
      sets: numberOrZero(next.workoutDefaults.sets),
      reps: numberOrZero(next.workoutDefaults.reps),
      restSeconds: numberOrZero(next.workoutDefaults.restSeconds),
      durationMinutes: numberOrZero(next.workoutDefaults.durationMinutes),
    },
    training: {
      experienceLevel: ['Beginner', 'Returning', 'Intermediate'].includes(next.training.experienceLevel) ? next.training.experienceLevel : 'Beginner',
      progressionMode: ['Guided', 'Flexible'].includes(next.training.progressionMode) ? next.training.progressionMode : 'Guided',
    },
    baseline: {
      goal: next.baseline.goal || 'Build consistency',
      workoutPlace: ['Gym', 'Home', 'Both'].includes(next.baseline.workoutPlace) ? next.baseline.workoutPlace : 'Gym',
      equipment: ['None', 'Dumbbells', 'Machines', 'Full gym'].includes(next.baseline.equipment) ? next.baseline.equipment : 'Full gym',
      limitations: String(next.baseline.limitations || '').trim(),
      currentWeight: numberOrZero(next.baseline.currentWeight),
      height: numberOrZero(next.baseline.height),
      bodyBaselineCreated: Boolean(next.baseline.bodyBaselineCreated),
    },
    meals: {
      calorieGoal: numberOrZero(next.meals.calorieGoal),
      proteinGoal: numberOrZero(next.meals.proteinGoal),
      macroStyle: next.meals.macroStyle || 'Balanced',
    },
    reminders: {
      workoutTime: next.reminders.workoutTime || '08:00',
      weighInDay: next.reminders.weighInDay || 'Monday',
      frequency: REMINDER_FREQUENCIES.includes(next.reminders.frequency) ? next.reminders.frequency : 'weekly',
    },
    display: {
      showBmi: next.display.showBmi !== false,
      hideProgressPhotosInPrivacy: next.display.hideProgressPhotosInPrivacy !== false,
    },
    exerciseLibrary: sanitizeExerciseLibrary(next.exerciseLibrary || []),
    mealCombos: (next.mealCombos || []).map(combo => ({
      name: String(combo.name || '').trim(),
      calories: numberOrZero(combo.calories),
      protein: numberOrZero(combo.protein),
      carbs: numberOrZero(combo.carbs),
      fat: numberOrZero(combo.fat),
    })),
  }
}

export function getExerciseGuide(name = '') {
  const normalized = String(name || '').trim().toLowerCase()
  if (!normalized) return null
  return FORM_GUIDES.find(guide => guide.match.some(term => normalized.includes(term)))
}

export function buildTemplateNotes(template = {}) {
  return [
    template.notes,
    template.progression ? `Progression: ${template.progression}` : '',
    template.deload ? `Deload: ${template.deload}` : '',
  ].filter(Boolean).join(' ')
}

export function getExerciseVideoGuide(exerciseName = '') {
  const normalized = String(exerciseName || '').trim().toLowerCase()
  if (!normalized) return null
  return EXERCISE_VIDEO_GUIDES.find(video => video.match.some(term => normalized.includes(term))) || null
}

export function safeScrollIntoView(node, options) {
  if (!node || typeof node.scrollIntoView !== 'function') return
  try {
    node.scrollIntoView(options)
  } catch {
    // Older iOS Safari can throw when scrollIntoView receives an options object.
    try {
      node.scrollIntoView(true)
    } catch {
      // noop
    }
  }
}

export function getYouTubeEmbedUrl(videoId = '', options = {}) {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    controls: '1',
  })

  if (options.autoplay) {
    params.set('autoplay', '1')
    if (options.muted !== false) params.set('mute', '1')
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

export function getPreferredTrainingTrack(settings = {}) {
  const workoutPlace = settings?.baseline?.workoutPlace || 'Gym'
  const equipment = settings?.baseline?.equipment || 'Full gym'
  if (workoutPlace === 'Home' || equipment === 'None') return 'home'
  if (workoutPlace === 'Both' && equipment === 'Dumbbells') return 'home'
  return 'gym'
}

export function getBeginnerTemplateCycle(settings = {}) {
  return getPreferredTrainingTrack(settings) === 'home'
    ? ['Beginner Home A', 'Beginner Home B']
    : ['Beginner Foundation A', 'Beginner Foundation B']
}

export function getResolvedRoutineDuration(duration, exercises = [], fallback = 0) {
  const manualDuration = numberOrZero(duration)
  if (manualDuration > 0) return manualDuration
  const estimatedDuration = estimateRoutineMinutes(exercises)
  if (estimatedDuration > 0) return estimatedDuration
  return numberOrZero(fallback)
}

export function getExerciseLoadHint(exerciseName = '', settings = {}) {
  const normalized = String(exerciseName || '').trim().toLowerCase()
  if (!normalized) return ''

  const beginner = (settings?.training?.experienceLevel || 'Beginner') === 'Beginner'
  const equipment = settings?.baseline?.equipment || 'Full gym'
  const homeTrack = getPreferredTrainingTrack(settings) === 'home'

  if (['push-up', 'push up', 'plank', 'dead bug', 'brisk walk', 'walk', 'stretch', 'bodyweight squat', 'glute bridge'].some(term => normalized.includes(term))) {
    return 'Start with bodyweight only. Add load only after two clean sessions.'
  }

  if (['bench press', 'squat', 'romanian deadlift', 'barbell row'].some(term => normalized.includes(term))) {
    return beginner ? 'Start with the empty bar or the lightest setup that feels smooth.' : 'Start with your last clean working weight, not your best-day weight.'
  }

  if (['lat pulldown', 'leg press', 'triceps pushdown', 'face pull'].some(term => normalized.includes(term))) {
    return equipment === 'None'
      ? 'Swap this for a home alternative or use resistance bands if available.'
      : 'Start with the lightest machine setting that lets every rep stay controlled.'
  }

  if (['goblet squat', 'dumbbell row', 'shoulder press', 'curl'].some(term => normalized.includes(term))) {
    if (equipment === 'None') return 'Use the bodyweight variation first, then add a backpack or dumbbell later.'
    return homeTrack
      ? 'Start with the lightest dumbbell you can fully control.'
      : 'Start with a light dumbbell and keep 2-3 reps in reserve.'
  }

  return 'Start lighter than you think and only add load after two clean sessions.'
}

export function getExerciseAlternativeHint(exerciseName = '', settings = {}) {
  const normalized = String(exerciseName || '').trim().toLowerCase()
  if (!normalized) return ''

  const homeTrack = getPreferredTrainingTrack(settings) === 'home'

  if (['bench press', 'incline dumbbell press'].some(term => normalized.includes(term))) {
    return homeTrack
      ? 'Swap to incline push-ups when you do not have a bench or dumbbells ready.'
      : 'Swap to incline push-ups if setup or shoulder comfort feels off today.'
  }

  if (['lat pulldown', 'pull-up', 'assisted pull-up'].some(term => normalized.includes(term))) {
    return homeTrack
      ? 'Swap to one-arm dumbbell rows or a band pulldown at home.'
      : 'Swap to one-arm dumbbell rows if the cable or pull-up setup is not available.'
  }

  if (['squat', 'leg press', 'goblet squat'].some(term => normalized.includes(term))) {
    return homeTrack
      ? 'Swap to a chair squat or bodyweight squat when load or balance feels too heavy.'
      : 'Swap to goblet squats if the rack or leg press feels too much today.'
  }

  if (['romanian deadlift', 'deadlift'].some(term => normalized.includes(term))) {
    return homeTrack
      ? 'Swap to glute bridges or hip hinges with a backpack when heavy pulls are not available.'
      : 'Swap to glute bridges if your low back or setup does not feel ready.'
  }

  if (['push-up', 'push up'].some(term => normalized.includes(term))) {
    return 'Use an incline on a bench, chair, or counter when the floor version breaks form.'
  }

  if (['brisk walk', 'walk', 'cardio'].some(term => normalized.includes(term))) {
    return 'Swap to marching in place, an easy bike, or a shorter recovery walk when time is tight.'
  }

  return ''
}

export function calculatePlates(targetWeight, unit = 'kg') {
  const isLbs = String(unit || '').toLowerCase() === 'lbs'
  const barWeight = isLbs ? 45 : 20
  const denominations = isLbs ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25]
  const remaining = targetWeight - barWeight
  if (remaining <= 0) return []
  const sideWeight = remaining / 2
  const plates = []
  let current = sideWeight
  const tolerance = 0.01
  for (const denom of denominations) {
    while (current + tolerance >= denom) {
      plates.push(denom)
      current -= denom
    }
  }
  return plates
}

export function getPlateStyle(denom, isLbs = false) {
  if (isLbs) {
    switch (denom) {
      case 45: return { color: '#ffffff', background: '#d32f2f', width: '12px', height: '20px' }
      case 35: return { color: '#ffffff', background: '#1976d2', width: '10px', height: '18px' }
      case 25: return { color: '#000000', background: '#fbc02d', width: '8px', height: '16px' }
      case 10: return { color: '#ffffff', background: '#388e3c', width: '6px', height: '14px' }
      case 5: return { color: '#000000', background: '#e0e0e0', width: '5px', height: '12px' }
      case 2.5: return { color: '#ffffff', background: '#424242', width: '4px', height: '10px' }
      default: return { color: '#ffffff', background: '#9e9e9e', width: '4px', height: '8px' }
    }
  } else {
    switch (denom) {
      case 25: return { color: '#ffffff', background: '#d32f2f', width: '12px', height: '20px' }
      case 20: return { color: '#ffffff', background: '#1976d2', width: '11px', height: '19px' }
      case 15: return { color: '#000000', background: '#fbc02d', width: '9px', height: '17px' }
      case 10: return { color: '#ffffff', background: '#388e3c', width: '7px', height: '15px' }
      case 5: return { color: '#000000', background: '#f5f5f5', width: '6px', height: '13px' }
      case 2.5: return { color: '#ffffff', background: '#424242', width: '5px', height: '11px' }
      case 1.25: return { color: '#ffffff', background: '#9e9e9e', width: '4px', height: '9px' }
      default: return { color: '#ffffff', background: '#607d8b', width: '4px', height: '8px' }
    }
  }
}

export const GENERAL_EXERCISE_SWAPS = {
  'bench press': ['Incline dumbbell press', 'Push-up', 'Chest fly machine'],
  'barbell row': ['One-arm dumbbell row', 'Lat pulldown', 'Seated cable row'],
  'squat': ['Leg press', 'Goblet squat', 'Leg extensions'],
  'deadlift': ['Romanian deadlift', 'Kettlebell swing', 'Glute bridge'],
  'romanian deadlift': ['Glute bridge', 'Hamstring curl machine', 'Kettlebell swing'],
  'lat pulldown': ['Assisted pull-up', 'One-arm dumbbell row', 'Seated cable row'],
  'pull-up': ['Lat pulldown', 'Assisted pull-up', 'Inverted row'],
  'goblet squat': ['Bodyweight squat', 'Leg press', 'Dumbbell lunge'],
  'shoulder press': ['Dumbbell lateral raise', 'Pike push-up', 'Arnold press'],
  'curl': ['Hammer curl', 'Preacher curl', 'Cable curl'],
  'push-up': ['Incline push-up', 'Dumbbell floor press', 'Kneeling push-up'],
  'brisk walk': ['Stationary bike', 'Marching in place', 'Rowing machine'],
  'glute bridge': ['Single-leg glute bridge', 'Romanian deadlift', 'Hip thrust'],
  'dead bug': ['Plank', 'Hollow body hold', 'Bird dog']
}

export function getExerciseSwapsList(exerciseName = '') {
  const normalized = String(exerciseName || '').trim().toLowerCase()
  if (!normalized) return []
  const matchKey = Object.keys(GENERAL_EXERCISE_SWAPS).find(key => normalized.includes(key))
  return matchKey ? GENERAL_EXERCISE_SWAPS[matchKey] : ['Bodyweight squats', 'Incline push-ups', 'One-arm dumbbell rows']
}

export function getExerciseActiveSeconds(exercise = {}) {
  const timedDuration = numberOrZero(exercise.duration)
  if (timedDuration > 0) return timedDuration
  const reps = numberOrZero(exercise.reps)
  return Math.max(30, reps > 0 ? reps * 4 : 45)
}

export function estimateExerciseMinutes(exercise = {}) {
  const sets = Math.max(1, numberOrZero(exercise.sets) || 1)
  const restSeconds = Math.max(0, numberOrZero(exercise.rest))
  const activeSeconds = getExerciseActiveSeconds(exercise)
  return Math.max(1, Math.round(((sets * activeSeconds) + ((sets - 1) * restSeconds)) / 60))
}

export function estimateRoutineMinutes(exercises = []) {
  return normalizeRows(exercises).reduce((sum, exercise) => sum + estimateExerciseMinutes(exercise), 0)
}

export function getExerciseSetCount(exercise = {}) {
  return Math.max(1, numberOrZero(exercise.sets) || 1)
}

export function getCompletedSetCount(completedSets = {}, index = 0) {
  return Object.values(completedSets?.[index] || {}).filter(Boolean).length
}

export function buildCompletedSetState(setCount = 1, done = true) {
  return Object.fromEntries(
    Array.from({ length: Math.max(1, setCount) }, (_, index) => [index + 1, done]),
  )
}

export function formatDurationClock(seconds = 0) {
  const totalSeconds = Math.max(0, Math.floor(numberOrZero(seconds)))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export function normalizeRows(rows = []) {
  return Array.isArray(rows) ? rows : []
}

export function normalizeExerciseKey(name = '') {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeExerciseSecondaryMuscles(value = []) {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(',')

  return Array.from(new Set(
    values
      .map(item => String(item || '').trim())
      .filter(Boolean),
  ))
}

export function sanitizeExerciseLibrary(entries = []) {
  const categorySet = new Set(EXERCISE_LIBRARY_CATEGORIES)
  const muscleSet = new Set(EXERCISE_MUSCLE_GROUPS)
  const map = new Map()

  normalizeRows(entries).forEach(entry => {
    const name = String(entry.name || '').trim()
    if (!name) return

    const primaryMuscle = muscleSet.has(entry.primaryMuscle) ? entry.primaryMuscle : 'Full body'
    const secondaryMuscles = normalizeExerciseSecondaryMuscles(entry.secondaryMuscles)
      .filter(muscle => muscleSet.has(muscle) && muscle !== primaryMuscle)

    map.set(normalizeExerciseKey(name), {
      name,
      category: categorySet.has(entry.category) ? entry.category : 'Strength',
      primaryMuscle,
      secondaryMuscles,
    })
  })

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function mergeExerciseLibrary(customEntries = []) {
  const map = new Map(
    DEFAULT_EXERCISE_LIBRARY.map(entry => [
      normalizeExerciseKey(entry.name),
      { ...entry, source: 'Built in' },
    ]),
  )

  sanitizeExerciseLibrary(customEntries).forEach(entry => {
    map.set(normalizeExerciseKey(entry.name), { ...entry, source: 'Custom' })
  })

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function buildExerciseMetaMap(entries = []) {
  return entries.reduce((map, entry) => {
    map[normalizeExerciseKey(entry.name)] = entry
    return map
  }, {})
}

export function dateDaysAgo(days) {
  const base = new Date(`${today()}T00:00:00`)
  base.setDate(base.getDate() - days)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

export function sortNewest(rows = []) {
  return [...rows].sort((a, b) => {
    const dateCompare = String(b.date || '').localeCompare(String(a.date || ''))
    if (dateCompare) return dateCompare
    return Number(b.createdAt || 0) - Number(a.createdAt || 0)
  })
}

export function revokeObjectUrl(value = '') {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    URL.revokeObjectURL(value)
  }
}

export function sortOldest(rows = []) {
  return [...rows].sort((a, b) => {
    const dateCompare = String(a.date || '').localeCompare(String(b.date || ''))
    if (dateCompare) return dateCompare
    return Number(a.createdAt || 0) - Number(b.createdAt || 0)
  })
}

export function numberOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function roundToNearest(value, step = 5) {
  const safeStep = Math.max(1, numberOrZero(step) || 1)
  return Math.round(numberOrZero(value) / safeStep) * safeStep
}

export function formatNumber(value, maximumFractionDigits = 0) {
  return numberOrZero(value).toLocaleString('en-PH', { maximumFractionDigits })
}

export function formatMonthLabel(monthKey = today().slice(0, 7)) {
  const [year, month] = String(monthKey || '').split('-').map(Number)
  if (!year || !month) return 'This month'
  return new Date(year, month - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}

export function getReferenceBodyWeight(bodyLogs = [], settings = {}) {
  const latestBody = normalizeRows(bodyLogs).find(row => numberOrZero(row.weight) > 0)
  if (latestBody?.weight) return numberOrZero(latestBody.weight)
  return numberOrZero(settings?.baseline?.currentWeight)
}

export function getRecompProteinGoal(weight = 0, unit = 'kg') {
  const rawWeight = numberOrZero(weight)
  const kg = unit === 'lb' ? rawWeight * 0.45359237 : rawWeight
  if (!kg) return 120
  return Math.max(110, Math.min(180, roundToNearest(kg * 1.8, 5)))
}

export function getRecompStarterDefaults(bodyLogs = [], settings = {}) {
  const weight = getReferenceBodyWeight(bodyLogs, settings)
  const proteinGoal = getRecompProteinGoal(weight, settings?.units?.weight || 'kg')

  return {
    proteinGoal,
    calorieGoal: numberOrZero(settings?.meals?.calorieGoal) || 2200,
    steps: Math.max(8000, numberOrZero(settings?.targets?.steps) || 0),
    water: Math.max(8, numberOrZero(settings?.targets?.water) || 0),
    sleep: Math.max(8, numberOrZero(settings?.targets?.sleep) || 0),
    workoutsPerWeek: 3,
  }
}

export function normalizePrimaryGoal(goal = '') {
  const normalized = String(goal || '').trim().toLowerCase()
  if (normalized === 'recomp') return 'recomp'
  if (normalized === 'lose weight') return 'lose-fat'
  if (normalized === 'gain muscle') return 'gain-muscle'
  if (normalized === 'get stronger') return 'strength'
  if (normalized === 'move more') return 'move-more'
  return 'consistency'
}

export function getNutritionMode(settings = {}) {
  const macroStyle = String(settings?.meals?.macroStyle || '').trim().toLowerCase()
  if (macroStyle === 'cutting') return 'cutting'
  if (macroStyle === 'bulking') return 'bulking'
  if (macroStyle === 'recomp') return 'recomp'
  if (macroStyle === 'high protein') return 'high-protein'
  return 'balanced'
}

export function getRecoveryState(score = 0, total = HABIT_OPTIONS.length) {
  const safeTotal = Math.max(1, numberOrZero(total) || 1)
  const safeScore = Math.max(0, numberOrZero(score))

  if (safeScore >= Math.max(5, safeTotal - 1)) {
    return {
      level: 'high',
      label: 'Ready to push',
      detail: 'Recovery looks strong enough for a full session today.',
    }
  }

  if (safeScore >= Math.ceil(safeTotal / 2)) {
    return {
      level: 'steady',
      label: 'Steady enough',
      detail: 'Train normally, but keep a little effort in reserve.',
    }
  }

  if (safeScore > 0) {
    return {
      level: 'low',
      label: 'Go lighter',
      detail: 'Use an easier session, lower load, or shorter volume today.',
    }
  }

  return {
    level: 'unknown',
    label: 'Check recovery',
    detail: 'No recovery check-in yet, so keep the first session conservative.',
  }
}

export function getWeightTrendSummary(bodyLogs = [], unit = 'kg') {
  const recent = sortOldest(normalizeRows(bodyLogs).filter(row => numberOrZero(row.weight) > 0)).slice(-4)
  if (recent.length < 2) {
    return {
      change: 0,
      direction: 'unknown',
      label: 'No weight trend yet',
    }
  }

  const first = numberOrZero(recent[0].weight)
  const last = numberOrZero(recent[recent.length - 1].weight)
  const change = last - first

  if (Math.abs(change) < 0.3) {
    return {
      change,
      direction: 'steady',
      label: `Weight is staying steady in ${unit}.`,
    }
  }

  return {
    change,
    direction: change > 0 ? 'up' : 'down',
    label: `${change > 0 ? 'Up' : 'Down'} ${formatNumber(Math.abs(change), 1)} ${unit} across recent logs.`,
  }
}

export function getTemplateForSessionKey(sessionKey = 'beginner', settings = {}, beginnerTemplate = BUILT_IN_ROUTINES[0]) {
  const session = GYM_SESSION_TYPES.find(row => row.key === sessionKey) || GYM_SESSION_TYPES[0]
  if (session.key === 'beginner') return beginnerTemplate
  if (session.key === 'running') {
    return {
      name: 'Outdoor Run',
      exercises: [{ name: 'Running', sets: 1, reps: 0, weight: 0 }],
    }
  }
  return BUILT_IN_ROUTINES.find(template => template.name === session.templateName) || BUILT_IN_ROUTINES[0]
}

export function getGoalDefaultSessionKey(settings = {}, options = {}) {
  const goal = normalizePrimaryGoal(settings?.baseline?.goal)
  const beginner = (settings?.training?.experienceLevel || 'Beginner') === 'Beginner'
  const preferredTrack = getPreferredTrainingTrack(settings)
  const recoveryLevel = options.recoveryLevel || 'steady'

  if (recoveryLevel === 'low') return 'recovery'
  if (beginner) return 'beginner'

  if (goal === 'move-more') return 'cardio'
  if (goal === 'strength') return preferredTrack === 'home' ? 'home' : 'push'
  if (goal === 'gain-muscle') return preferredTrack === 'home' ? 'home' : 'push'
  if (goal === 'lose-fat') return preferredTrack === 'home' ? 'home' : 'full-body'
  if (goal === 'recomp') return preferredTrack === 'home' ? 'home' : 'full-body'

  return preferredTrack === 'home' ? 'home' : 'full-body'
}

export function getGoalLabel(goalKey = 'consistency') {
  return {
    recomp: 'Recomp',
    'lose-fat': 'Lose fat',
    'gain-muscle': 'Gain muscle',
    strength: 'Get stronger',
    'move-more': 'Move more',
    consistency: 'Build consistency',
  }[goalKey] || 'Build consistency'
}

export function estimateOneRepMax(weight = 0, reps = 0) {
  const load = numberOrZero(weight)
  const count = numberOrZero(reps)
  if (!load || !count) return 0
  return load * (1 + (Math.min(count, 12) / 30))
}

export function hydrateExerciseRows(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return [createExerciseRow()]
  return rows.map(row => createExerciseRow({
    name: row.name || '',
    sets: row.sets || row.sets === 0 ? String(row.sets) : '',
    reps: row.reps || row.reps === 0 ? String(row.reps) : '',
    weight: numberOrZero(row.weight) > 0 ? String(row.weight) : '',
    duration: numberOrZero(row.duration) > 0 ? String(row.duration) : '',
    rest: row.rest || row.rest === 0 ? String(row.rest) : '',
    notes: row.notes || '',
  }))
}

export function sanitizeExerciseRows(rows = []) {
  return normalizeRows(rows)
    .map(row => ({
      name: String(row.name || '').trim(),
      sets: numberOrZero(row.sets),
      reps: numberOrZero(row.reps),
      weight: numberOrZero(row.weight),
      duration: numberOrZero(row.duration),
      rest: numberOrZero(row.rest),
      notes: String(row.notes || '').trim(),
    }))
    .filter(row => row.name)
}

export function getExerciseTotals(exercises = []) {
  return exercises.reduce((summary, row) => {
    const sets = numberOrZero(row.sets)
    const reps = numberOrZero(row.reps)
    const weight = numberOrZero(row.weight)
    return {
      exerciseCount: summary.exerciseCount + 1,
      setCount: summary.setCount + sets,
      volume: summary.volume + (sets * reps * weight),
    }
  }, { exerciseCount: 0, setCount: 0, volume: 0 })
}

export function formatExerciseLine(row = {}, hidden = false, weightUnit = 'kg') {
  const sets = numberOrZero(row.sets)
  const reps = numberOrZero(row.reps)
  const duration = numberOrZero(row.duration)
  const rest = numberOrZero(row.rest)
  const weight = numberOrZero(row.weight)
  const effort = duration
    ? `${formatNumber(duration)}s`
    : reps
      ? `${sets || 1}x${formatNumber(reps)}`
      : `${sets || 1} sets`
  const load = weight && !hidden ? ` @ ${formatNumber(weight, 1)}${weightUnit}` : ''
  const restText = rest ? `, ${formatNumber(rest)}s rest` : ''
  return `${row.name || 'Exercise'} ${effort}${load}${restText}`
}

export function buildExerciseHistoryMap(workouts = []) {
  return sortNewest(workouts).reduce((map, workout) => {
    normalizeRows(workout.exercises).forEach(exercise => {
      const key = normalizeExerciseKey(exercise.name)
      if (!key) return

      if (!map[key]) {
        map[key] = {
          name: exercise.name || 'Exercise',
          workoutTitle: workout.title || 'Workout',
          date: workout.date || '',
          sets: numberOrZero(exercise.sets),
          reps: numberOrZero(exercise.reps),
          weight: numberOrZero(exercise.weight),
          duration: numberOrZero(exercise.duration),
          rest: numberOrZero(exercise.rest),
          notes: String(exercise.notes || '').trim(),
          count: 0,
        }
      }

      map[key].count += 1
    })

    return map
  }, {})
}

export function buildExerciseAnalytics(workouts = [], exerciseMetaMap = {}) {
  const exerciseMap = {}
  const muscleMap = {}

  sortOldest(workouts).forEach(workout => {
    normalizeRows(workout.exercises).forEach(exercise => {
      const key = normalizeExerciseKey(exercise.name)
      if (!key) return

      const sets = Math.max(1, numberOrZero(exercise.sets) || 1)
      const reps = numberOrZero(exercise.reps)
      const weight = numberOrZero(exercise.weight)
      const duration = numberOrZero(exercise.duration)
      const volume = sets * reps * weight
      const oneRepMax = estimateOneRepMax(weight, reps)
      const meta = exerciseMetaMap[key] || {
        category: duration > 0 ? 'Cardio' : 'Strength',
        primaryMuscle: duration > 0 ? 'Cardio' : 'Full body',
        secondaryMuscles: [],
        source: 'Built in',
      }

      if (!exerciseMap[key]) {
        exerciseMap[key] = {
          key,
          name: String(exercise.name || 'Exercise').trim(),
          category: meta.category,
          primaryMuscle: meta.primaryMuscle,
          secondaryMuscles: normalizeExerciseSecondaryMuscles(meta.secondaryMuscles),
          source: meta.source || 'Built in',
          totalSets: 0,
          totalReps: 0,
          totalVolume: 0,
          totalDuration: 0,
          bestWeight: 0,
          bestReps: 0,
          bestOneRm: 0,
          lastDate: '',
          lastWorkoutTitle: '',
          history: [],
          sessionKeys: new Set(),
        }
      }

      const current = exerciseMap[key]
      current.totalSets += sets
      current.totalReps += sets * reps
      current.totalVolume += volume
      current.totalDuration += duration
      current.bestWeight = Math.max(current.bestWeight, weight)
      current.bestReps = Math.max(current.bestReps, reps)
      current.bestOneRm = Math.max(current.bestOneRm, oneRepMax)
      current.sessionKeys.add(String(workout._id || workout.createdAt || workout.date || current.name))

      if (!current.lastDate || String(workout.date || '') >= current.lastDate) {
        current.lastDate = String(workout.date || '')
        current.lastWorkoutTitle = workout.title || 'Workout'
      }

      current.history.push({
        key: `${workout._id || workout.createdAt || workout.date || current.name}-${current.history.length}`,
        label: String(workout.date || '').slice(5) || 'Saved',
        date: String(workout.date || ''),
        value: oneRepMax || volume || sets,
        metric: oneRepMax ? '1RM' : volume ? 'Volume' : 'Sets',
        weight,
        reps,
        sets,
        duration,
        volume,
        oneRepMax,
      })

      muscleMap[current.primaryMuscle] = numberOrZero(muscleMap[current.primaryMuscle]) + sets
      current.secondaryMuscles.forEach(muscle => {
        muscleMap[muscle] = numberOrZero(muscleMap[muscle]) + (sets * 0.5)
      })
    })
  })

  const exercises = Object.values(exerciseMap)
    .map(entry => ({
      ...entry,
      sessionCount: entry.sessionKeys.size,
      history: entry.history.slice(-6),
    }))
    .sort((a, b) => {
      const volumeCompare = numberOrZero(b.totalVolume) - numberOrZero(a.totalVolume)
      if (volumeCompare) return volumeCompare
      return numberOrZero(b.sessionCount) - numberOrZero(a.sessionCount)
    })

  const historyCharts = exercises
    .filter(entry => entry.history.length > 1)
    .slice(0, 3)
    .map(entry => {
      const useOneRm = entry.history.some(point => numberOrZero(point.oneRepMax) > 0)
      const metric = useOneRm ? 'Estimated 1RM' : entry.history.some(point => numberOrZero(point.volume) > 0) ? 'Volume' : 'Sets'
      return {
        key: entry.key,
        name: entry.name,
        metric,
        rows: entry.history.map(point => ({
          key: point.key,
          label: point.label,
          value: useOneRm
            ? numberOrZero(point.oneRepMax)
            : metric === 'Volume'
              ? numberOrZero(point.volume)
              : numberOrZero(point.sets),
        })),
      }
    })

  const muscleDistribution = Object.entries(muscleMap)
    .map(([label, value]) => ({ label, value: Math.round(numberOrZero(value) * 10) / 10 }))
    .sort((a, b) => b.value - a.value)

  return {
    exercises,
    mainExercises: exercises.slice(0, 6),
    historyCharts,
    muscleDistribution,
  }
}

export function buildMonthlyReport(workouts = [], activities = [], bodyLogs = [], exerciseMetaMap = {}, monthKey = today().slice(0, 7)) {
  const monthWorkouts = workouts.filter(row => String(row.date || '').startsWith(monthKey))
  const monthActivities = activities.filter(row => String(row.date || '').startsWith(monthKey))
  const monthBodyLogs = bodyLogs.filter(row => String(row.date || '').startsWith(monthKey))
  const workoutVolume = monthWorkouts.reduce((sum, workout) => (
    sum + (numberOrZero(workout.volume) || getExerciseTotals(normalizeRows(workout.exercises)).volume)
  ), 0)
  const activeMinutes = monthActivities.reduce((sum, activity) => (
    sum + numberOrZero(activity.cardioMinutes) + numberOrZero(activity.walkingMinutes) + numberOrZero(activity.activeMinutes)
  ), 0)
  const steps = monthActivities.reduce((sum, activity) => sum + numberOrZero(activity.steps), 0)
  const activeDays = new Set([
    ...monthWorkouts.map(row => row.date),
    ...monthActivities
      .filter(row => numberOrZero(row.steps) || numberOrZero(row.cardioMinutes) || numberOrZero(row.walkingMinutes) || numberOrZero(row.activeMinutes))
      .map(row => row.date),
  ]).size
  const monthExerciseInsights = buildExerciseAnalytics(monthWorkouts, exerciseMetaMap)
  const topExercise = monthExerciseInsights.mainExercises[0] || null

  return {
    label: formatMonthLabel(monthKey),
    workoutCount: monthWorkouts.length,
    workoutVolume,
    activeMinutes,
    steps,
    activeDays,
    bodyCheckIns: monthBodyLogs.length,
    topExercise,
  }
}

export function buildYearInReview(workouts = [], activities = [], bodyLogs = [], exerciseMetaMap = {}, yearKey = today().slice(0, 4)) {
  const yearWorkouts = workouts.filter(row => String(row.date || '').startsWith(yearKey))
  const yearActivities = activities.filter(row => String(row.date || '').startsWith(yearKey))
  const yearBodyLogs = bodyLogs.filter(row => String(row.date || '').startsWith(yearKey))
  const workoutVolume = yearWorkouts.reduce((sum, workout) => (
    sum + (numberOrZero(workout.volume) || getExerciseTotals(normalizeRows(workout.exercises)).volume)
  ), 0)
  const activeMinutes = yearActivities.reduce((sum, activity) => (
    sum + numberOrZero(activity.cardioMinutes) + numberOrZero(activity.walkingMinutes) + numberOrZero(activity.activeMinutes)
  ), 0)
  const steps = yearActivities.reduce((sum, activity) => sum + numberOrZero(activity.steps), 0)
  const activeDays = new Set([
    ...yearWorkouts.map(row => row.date),
    ...yearActivities
      .filter(row => numberOrZero(row.steps) || numberOrZero(row.cardioMinutes) || numberOrZero(row.walkingMinutes) || numberOrZero(row.activeMinutes))
      .map(row => row.date),
  ]).size
  const yearExerciseInsights = buildExerciseAnalytics(yearWorkouts, exerciseMetaMap)
  const topExercise = yearExerciseInsights.mainExercises[0] || null
  const strongestExercise = [...yearExerciseInsights.exercises]
    .sort((a, b) => numberOrZero(b.bestOneRm) - numberOrZero(a.bestOneRm))[0] || null
  const monthReports = Array.from(new Set(yearWorkouts.map(row => String(row.date || '').slice(0, 7))))
    .sort()
    .map(monthKey => buildMonthlyReport(yearWorkouts, yearActivities, yearBodyLogs, exerciseMetaMap, monthKey))
  const bestMonth = [...monthReports]
    .sort((a, b) => numberOrZero(b.workoutCount) - numberOrZero(a.workoutCount) || numberOrZero(b.workoutVolume) - numberOrZero(a.workoutVolume))[0] || null

  return {
    yearKey,
    workoutCount: yearWorkouts.length,
    workoutVolume,
    activeMinutes,
    steps,
    activeDays,
    bodyCheckIns: yearBodyLogs.length,
    topExercise,
    strongestExercise,
    bestMonth,
  }
}

export function formatPreviousExerciseSummary(entry = {}, weightUnit = 'kg') {
  if (!entry) return ''
  const effort = entry.duration > 0
    ? `${formatNumber(entry.duration)}s`
    : entry.reps > 0
      ? `${entry.sets || 1}x${formatNumber(entry.reps)}`
      : `${entry.sets || 1} sets`
  const load = entry.weight > 0 ? ` @ ${formatNumber(entry.weight, 1)}${weightUnit}` : ''
  const rest = entry.rest > 0 ? ` · ${formatNumber(entry.rest)}s rest` : ''
  return `${effort}${load}${rest}`
}

export function getRoutineGroupLabel(routine = {}) {
  const explicit = String(routine.folder || '').trim()
  if (explicit) return explicit

  const focus = String(routine.focus || '').trim().toLowerCase()
  const name = String(routine.name || '').trim().toLowerCase()

  if (focus === 'beginner') return 'Starter programs'
  if (name.includes('home') || name.includes('travel')) return 'Home & travel'
  if (focus === 'cardio' || focus === 'mobility' || name.includes('recovery')) return 'Cardio & recovery'
  if (focus === 'strength' || focus === 'hypertrophy' || focus === 'conditioning') return 'Gym routines'
  return 'General'
}

export function groupRoutinesByLabel(routines = []) {
  const groups = normalizeRows(routines).reduce((map, routine) => {
    const label = getRoutineGroupLabel(routine)
    if (!map[label]) map[label] = []
    map[label].push(routine)
    return map
  }, {})

  return Object.entries(groups).map(([label, rows]) => ({
    label,
    description: ROUTINE_LIBRARY_META[label] || ROUTINE_LIBRARY_META.General,
    rows,
  }))
}

export function displayMetric(value, unit = '', hidden = false, decimals = 1) {
  if (hidden) return unit ? `... ${unit}` : '...'
  const numeric = Number(value) || 0
  return `${numeric.toLocaleString('en-PH', { maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ''}`
}

export function calculateBmi(weight, height, weightUnit = 'kg', bodyUnit = 'cm') {
  const rawWeight = numberOrZero(weight)
  const rawHeight = numberOrZero(height)
  if (!rawWeight || !rawHeight) return 0
  const kg = weightUnit === 'lb' ? rawWeight * 0.45359237 : rawWeight
  const meters = bodyUnit === 'in' ? rawHeight * 0.0254 : rawHeight / 100
  if (!meters) return 0
  return kg / (meters * meters)
}

export function getBmiLabel(bmi) {
  if (!bmi) return 'Add height'
  if (bmi < 18.5) return 'Under range'
  if (bmi < 25) return 'Healthy range'
  if (bmi < 30) return 'Above range'
  return 'High range'
}

export function getLastDateKeys(days = 7) {
  return Array.from({ length: days }, (_, index) => dateDaysAgo(days - 1 - index))
}

export function addMonths(monthKey, delta) {
  const [year, month] = String(monthKey || today().slice(0, 7)).split('-').map(Number)
  const base = new Date(year || new Date().getFullYear(), (month || 1) - 1 + delta, 1)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthDays(monthKey) {
  const [year, month] = String(monthKey || today().slice(0, 7)).split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  const leading = start.getDay()
  const days = []

  for (let index = 0; index < leading; index += 1) {
    days.push({ key: `empty-${index}`, empty: true })
  }

  for (let day = 1; day <= end.getDate(); day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({ key, day, empty: false })
  }

  return days
}

export function createDateMap(rows = []) {
  return normalizeRows(rows).reduce((map, row) => {
    const key = row.date
    if (!key) return map
    if (!map[key]) map[key] = []
    map[key].push(row)
    return map
  }, {})
}

export function calculateWorkoutStreak(workouts = []) {
  const dates = new Set(workouts.map(row => row.date).filter(Boolean))
  let current = today()
  let streak = 0
  while (dates.has(current)) {
    streak += 1
    current = dateDaysAgo(streak)
  }
  return streak
}

export function getPersonalRecords(workouts = [], activities = []) {
  const records = {
    bestLift: null,
    mostReps: null,
    highestVolume: null,
    longestWorkout: null,
    longestCardio: null,
    workoutStreak: calculateWorkoutStreak(workouts),
  }

  workouts.forEach(workout => {
    const workoutVolume = numberOrZero(workout.volume) || getExerciseTotals(workout.exercises).volume
    if (workoutVolume && (!records.highestVolume || workoutVolume > records.highestVolume.value)) {
      records.highestVolume = { label: workout.title || 'Workout', value: workoutVolume, unit: 'kg volume' }
    }

    const duration = numberOrZero(workout.duration)
    if (duration && (!records.longestWorkout || duration > records.longestWorkout.value)) {
      records.longestWorkout = { label: workout.title || 'Workout', value: duration, unit: 'min' }
    }

    normalizeRows(workout.exercises).forEach(exercise => {
      const weight = numberOrZero(exercise.weight)
      const reps = numberOrZero(exercise.reps)
      if (weight && (!records.bestLift || weight > records.bestLift.value)) {
        records.bestLift = { label: exercise.name || 'Exercise', value: weight, unit: 'kg' }
      }
      if (reps && (!records.mostReps || reps > records.mostReps.value)) {
        records.mostReps = { label: exercise.name || 'Exercise', value: reps, unit: 'reps' }
      }
    })
  })

  activities.forEach(activity => {
    const duration = numberOrZero(activity.cardioMinutes) + numberOrZero(activity.walkingMinutes) + numberOrZero(activity.activeMinutes)
    if (duration && (!records.longestCardio || duration > records.longestCardio.value)) {
      records.longestCardio = { label: activity.type || 'Activity', value: duration, unit: 'min' }
    }
  })

  return records
}

export function getBeginnerProgression(workouts = [], settings = {}) {
  const beginnerTemplateNames = [
    'Beginner Foundation A',
    'Beginner Foundation B',
    'Beginner Home A',
    'Beginner Home B',
  ]
  const templateCycle = getBeginnerTemplateCycle(settings)
  const trackLabel = getPreferredTrainingTrack(settings) === 'home' ? 'Home starter track' : 'Gym starter track'
  const foundationWorkouts = sortOldest(workouts).filter(workout => {
    const name = `${workout.title || ''} ${workout.routineName || ''}`.toLowerCase()
    return beginnerTemplateNames.some(templateName => name.includes(templateName.toLowerCase()))
  })
  const completed = foundationWorkouts.length
  const phaseIndex = completed < 4 ? 0 : completed < 8 ? 1 : 2
  const nextTemplateName = templateCycle[completed % templateCycle.length]
  const lastSession = foundationWorkouts[foundationWorkouts.length - 1]

  return {
    completed,
    trackLabel,
    phase: BEGINNER_PHASES[phaseIndex],
    progress: Math.min(100, Math.round((completed / 8) * 100)),
    nextTemplateName,
    weeklyTarget: completed < 8 ? 'Aim for 2 foundation sessions/week' : 'Keep 2-3 sessions/week',
    lastSessionLabel: lastSession ? `${lastSession.title || 'Foundation'} on ${formatDisplayDate(lastSession.date)}` : 'No foundation session yet',
    nextAction: completed === 0
      ? `Start with ${nextTemplateName} today. Keep every set easy enough that you could do 2-3 more reps.`
      : `Next recommended: ${nextTemplateName}. Repeat the same load if form, sleep, or soreness felt off.`,
    rules: [
      'Add reps before adding weight.',
      'Only add weight after two clean sessions.',
      'If pain is sharp or form breaks, stop the set.',
    ],
  }
}

export function getHabitScore(row = {}) {
  return HABIT_OPTIONS.reduce((score, option) => score + (row[option.key] ? 1 : 0), 0)
}

