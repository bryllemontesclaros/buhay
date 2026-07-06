import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  fsAdd,
  fsDel,
  fsDeleteLakasBodyLog,
  fsDeleteLakasMeal,
  fsSaveLakasBodyLog,
  fsSaveLakasMeal,
  fsSetProfile,
  fsUpdate,
} from '../lib/firestore'
import { confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { loadStorageObjectUrl } from '../lib/storageMedia'
import { formatDisplayDate, today } from '../lib/utils'
import styles from './Page.module.css'
import lStyles from './Lakas.module.css'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

function getWeeklyScore(workouts, habits, weekIndex = 0) {
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

function LakasLeaderboard({ workouts = [], habits = [], settings = {}, privacyMode = false }) {
  const currentWeek = useMemo(() => getWeeklyScore(workouts, habits, 0), [workouts, habits])
  const historyWeeks = useMemo(() => Array.from({ length: 8 }, (_, i) => getWeeklyScore(workouts, habits, i + 1)), [workouts, habits])

  const personalBest = useMemo(() => {
    const scores = historyWeeks.map(w => w.score)
    return scores.length > 0 ? Math.max(50, ...scores) : 50
  }, [historyWeeks])

  const averageWeek = useMemo(() => {
    if (historyWeeks.length === 0) return 30
    const sum = historyWeeks.reduce((acc, w) => acc + w.score, 0)
    return Math.round(sum / historyWeeks.length)
  }, [historyWeeks])

  const leaderboardRows = useMemo(() => {
    const goal = settings?.baseline?.goal || 'Consistency'
    const rows = [
      { name: 'IronBeast', score: Math.max(12, averageWeek + 15), track: 'Powerlifter', isUser: false },
      { name: 'ZenStep', score: Math.max(8, averageWeek + 5), track: 'Habit Champ', isUser: false },
      { name: 'FlexPace', score: Math.max(6, averageWeek - 8), track: 'Marathoner', isUser: false },
      { name: 'CalmMover', score: Math.max(2, averageWeek - 18), track: 'Yoga Focus', isUser: false },
      { name: 'You', score: currentWeek.score, track: goal, isUser: true },
    ]
    return [...rows].sort((a, b) => b.score - a.score)
  }, [averageWeek, currentWeek.score, settings])

  return (
    <div className={lStyles.leaderboardContainer}>
      <div className={lStyles.leaderboardSectionTitle}>Ghost Racer (Self-Competition)</div>
      <p className={lStyles.leaderboardSubtitle}>Compare this week's progress against your best and average standards.</p>
      
      <div className={lStyles.podiumGrid}>
        <div className={`${lStyles.podiumCol} ${lStyles.podiumBronze}`}>
          <div className={lStyles.podiumVal}>{privacyMode ? '••' : averageWeek} <small>pts</small></div>
          <div className={lStyles.podiumBar} style={{ height: '50px' }}>
            <span className={lStyles.podiumRank}>3</span>
          </div>
          <div className={lStyles.podiumLabel}>Average Week</div>
        </div>

        <div className={`${lStyles.podiumCol} ${lStyles.podiumGold}`}>
          <div className={lStyles.podiumVal}>{privacyMode ? '••' : personalBest} <small>pts</small></div>
          <div className={lStyles.podiumBar} style={{ height: '90px' }}>
            <span className={lStyles.podiumRank}>1</span>
          </div>
          <div className={lStyles.podiumLabel}>Personal Best</div>
        </div>

        <div className={`${lStyles.podiumCol} ${lStyles.podiumSilver} ${currentWeek.score >= personalBest ? lStyles.podiumSilverWinner : ''}`}>
          <div className={lStyles.podiumVal}>{privacyMode ? '••' : currentWeek.score} <small>pts</small></div>
          <div className={lStyles.podiumBar} style={{ height: '70px' }}>
            <span className={lStyles.podiumRank}>2</span>
          </div>
          <div className={lStyles.podiumLabel}>This Week</div>
        </div>
      </div>

      <div className={lStyles.leaderboardQuote}>
        {currentWeek.score >= personalBest ? (
          <span style={{ color: 'var(--accent)' }}>🔥 You are beating your personal best! Outstanding work.</span>
        ) : (
          <span>You need <strong>{privacyMode ? '••' : (personalBest - currentWeek.score)}</strong> more points to beat your personal best. Log another workout or hydration check!</span>
        )}
      </div>

      <div className={lStyles.leaderboardSectionTitle} style={{ marginTop: '28px' }}>Weekly Cohort Consistency</div>
      <p className={lStyles.leaderboardSubtitle}>Ranked against active peers on similar training tracks based on trailing 7-day consistency points.</p>

      <div className={lStyles.cohortList}>
        {leaderboardRows.map((row, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎗'
          return (
            <div key={row.name} className={`${lStyles.cohortRow} ${row.isUser ? lStyles.cohortRowUser : ''}`}>
              <div className={lStyles.cohortRank}>
                <span>{medal}</span>
                <strong>{idx + 1}</strong>
              </div>
              <div className={lStyles.cohortMeta}>
                <strong>{row.name}</strong>
                <span>{row.track}</span>
              </div>
              <div className={lStyles.cohortScore}>
                {privacyMode ? '••' : row.score} <small>pts</small>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const FOOD_PRESETS = [
  { name: 'White rice (1 cup)', calories: 205, protein: 4, carbs: 45, fat: 0 },
  { name: 'Chicken adobo', calories: 320, protein: 28, carbs: 6, fat: 20 },
  { name: 'Boiled egg', calories: 78, protein: 6, carbs: 1, fat: 5 },
  { name: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: 'Chicken breast 150g', calories: 248, protein: 46, carbs: 0, fat: 5 },
  { name: 'Tuna flakes', calories: 180, protein: 24, carbs: 2, fat: 8 },
  { name: 'Pancit serving', calories: 350, protein: 12, carbs: 52, fat: 11 },
  { name: 'Milk tea regular', calories: 420, protein: 5, carbs: 70, fat: 12 },
]

const RECOMP_STARTER_RULES = [
  'Train 3 days per week before adding more days.',
  'Keep 2-3 reps in reserve on every set for the first month.',
  'Add reps before adding weight.',
  'Keep daily walking high so fat loss happens without crash dieting.',
]

const RECOMP_NUTRITION_GUIDE = {
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

const BEGINNER_PHASES = [
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

const FORM_GUIDES = [
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

const GYM_SESSION_TYPES = [
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

const EXERCISE_VIDEO_GUIDES = [
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

const BUILT_IN_ROUTINES = [
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

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const GOAL_TYPES = ['Workout', 'Weight', 'Calories', 'Protein', 'Steps', 'Body', 'Habit', 'Custom']
const ROUTINE_FOCUS = ['Beginner', 'Strength', 'Hypertrophy', 'Cardio', 'Mobility', 'Conditioning', 'Custom']
const ACTIVITY_TYPES = ['Walk', 'Run', 'Cardio', 'Cycling', 'Sport', 'Active day']
const REMINDER_TYPES = ['Workout', 'Weigh-in', 'Rest day', 'Steps', 'Habit', 'Meal prep']
const REMINDER_FREQUENCIES = ['once', 'daily', 'weekly', 'monthly']
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const ROUTINE_LIBRARY_META = {
  'Starter programs': 'Simple beginner-first sessions for building confidence and consistency.',
  'Gym routines': 'Push, pull, legs, and full-body templates for structured gym days.',
  'Home & travel': 'Low-equipment options for home weeks, travel days, or backup training.',
  'Cardio & recovery': 'Lower-intensity sessions for conditioning, mobility, and reset days.',
  General: 'Saved routines that do not fit a preset group yet.',
}

const EXERCISE_LIBRARY_CATEGORIES = ['Strength', 'Cardio', 'Mobility', 'Recovery']
const EXERCISE_MUSCLE_GROUPS = [
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

const DEFAULT_EXERCISE_LIBRARY = [
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

const HABIT_OPTIONS = [
  { key: 'water', label: 'Water' },
  { key: 'protein', label: 'Protein' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'stretching', label: 'Stretching' },
  { key: 'restDay', label: 'Rest day' },
  { key: 'vitamins', label: 'Vitamins' },
]

const DEFAULT_LAKAS_SETTINGS = {
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

const LAKAS_TAB_COPY = {
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

const LAKAS_TRACK_VIEWS = [
  { id: 'meals', label: 'Meals', meta: 'Nutrition log' },
  { id: 'body', label: 'Body', meta: 'Measurements and weight' },
  { id: 'activity', label: 'Movement', meta: 'Steps and active minutes' },
  { id: 'recovery', label: 'Recovery', meta: 'Habits and check-ins' },
]

const VALID_LAKAS_TRACK_VIEWS = new Set(['meals', 'body', 'activity', 'recovery', 'goals'])

function getTrackViewForTab(tab = '') {
  if (tab === 'measurements' || tab === 'body-log') return 'body'
  if (tab === 'activity') return 'activity'
  if (tab === 'habits' || tab === 'recovery') return 'recovery'
  if (tab === 'goals') return 'goals'
  return 'meals'
}

function normalizeTrackView(view = '', activeTab = '') {
  return VALID_LAKAS_TRACK_VIEWS.has(view) ? view : getTrackViewForTab(activeTab)
}

function createExerciseRow(overrides = {}, defaults = {}) {
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

function createWorkoutForm(settings = DEFAULT_LAKAS_SETTINGS) {
  return {
    routineId: '',
    date: today(),
    title: '',
    duration: settings.workoutDefaults?.durationMinutes ? String(settings.workoutDefaults.durationMinutes) : '',
    exercises: [createExerciseRow({}, settings.workoutDefaults)],
    notes: '',
  }
}

function createRoutineForm(settings = DEFAULT_LAKAS_SETTINGS) {
  return {
    name: '',
    focus: 'Strength',
    duration: settings.workoutDefaults?.durationMinutes ? String(settings.workoutDefaults.durationMinutes) : '',
    exercises: [createExerciseRow({}, settings.workoutDefaults)],
    notes: '',
  }
}

function createMealForm() {
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

function getMediaSaveErrorMessage(error, kind = 'photo') {
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

function isRetryableMediaSaveError(error) {
  const code = String(error?.code || '')
  return code === 'storage/retry-limit-exceeded' || code === 'storage/unknown'
}

function createBodyForm() {
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

function createActivityForm() {
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

function createHabitForm() {
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

function createGoalForm() {
  return {
    name: '',
    type: 'Workout',
    target: '',
    current: '',
    unit: 'sessions',
  }
}

function createExerciseLibraryDraft() {
  return {
    name: '',
    category: 'Strength',
    primaryMuscle: 'Full body',
    secondaryMuscles: '',
  }
}

function createReminderForm(settings = DEFAULT_LAKAS_SETTINGS) {
  return {
    title: '',
    type: 'Workout',
    date: today(),
    time: settings.reminders?.workoutTime || '08:00',
    frequency: settings.reminders?.frequency || 'weekly',
    notes: '',
  }
}

function getLakasSettings(profile = {}) {
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

function sanitizeLakasSettings(settings = {}) {
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

function getExerciseGuide(name = '') {
  const normalized = String(name || '').trim().toLowerCase()
  if (!normalized) return null
  return FORM_GUIDES.find(guide => guide.match.some(term => normalized.includes(term)))
}

function buildTemplateNotes(template = {}) {
  return [
    template.notes,
    template.progression ? `Progression: ${template.progression}` : '',
    template.deload ? `Deload: ${template.deload}` : '',
  ].filter(Boolean).join(' ')
}

function getExerciseVideoGuide(exerciseName = '') {
  const normalized = String(exerciseName || '').trim().toLowerCase()
  if (!normalized) return null
  return EXERCISE_VIDEO_GUIDES.find(video => video.match.some(term => normalized.includes(term))) || null
}

function safeScrollIntoView(node, options) {
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

function getYouTubeEmbedUrl(videoId = '', options = {}) {
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

function getPreferredTrainingTrack(settings = {}) {
  const workoutPlace = settings?.baseline?.workoutPlace || 'Gym'
  const equipment = settings?.baseline?.equipment || 'Full gym'
  if (workoutPlace === 'Home' || equipment === 'None') return 'home'
  if (workoutPlace === 'Both' && equipment === 'Dumbbells') return 'home'
  return 'gym'
}

function getBeginnerTemplateCycle(settings = {}) {
  return getPreferredTrainingTrack(settings) === 'home'
    ? ['Beginner Home A', 'Beginner Home B']
    : ['Beginner Foundation A', 'Beginner Foundation B']
}

function getResolvedRoutineDuration(duration, exercises = [], fallback = 0) {
  const manualDuration = numberOrZero(duration)
  if (manualDuration > 0) return manualDuration
  const estimatedDuration = estimateRoutineMinutes(exercises)
  if (estimatedDuration > 0) return estimatedDuration
  return numberOrZero(fallback)
}

function getExerciseLoadHint(exerciseName = '', settings = {}) {
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

function getExerciseAlternativeHint(exerciseName = '', settings = {}) {
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

function calculatePlates(targetWeight, unit = 'kg') {
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

function getPlateStyle(denom, isLbs = false) {
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

const GENERAL_EXERCISE_SWAPS = {
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

function getExerciseSwapsList(exerciseName = '') {
  const normalized = String(exerciseName || '').trim().toLowerCase()
  if (!normalized) return []
  const matchKey = Object.keys(GENERAL_EXERCISE_SWAPS).find(key => normalized.includes(key))
  return matchKey ? GENERAL_EXERCISE_SWAPS[matchKey] : ['Bodyweight squats', 'Incline push-ups', 'One-arm dumbbell rows']
}

function getExerciseActiveSeconds(exercise = {}) {
  const timedDuration = numberOrZero(exercise.duration)
  if (timedDuration > 0) return timedDuration
  const reps = numberOrZero(exercise.reps)
  return Math.max(30, reps > 0 ? reps * 4 : 45)
}

function estimateExerciseMinutes(exercise = {}) {
  const sets = Math.max(1, numberOrZero(exercise.sets) || 1)
  const restSeconds = Math.max(0, numberOrZero(exercise.rest))
  const activeSeconds = getExerciseActiveSeconds(exercise)
  return Math.max(1, Math.round(((sets * activeSeconds) + ((sets - 1) * restSeconds)) / 60))
}

function estimateRoutineMinutes(exercises = []) {
  return normalizeRows(exercises).reduce((sum, exercise) => sum + estimateExerciseMinutes(exercise), 0)
}

function getExerciseSetCount(exercise = {}) {
  return Math.max(1, numberOrZero(exercise.sets) || 1)
}

function getCompletedSetCount(completedSets = {}, index = 0) {
  return Object.values(completedSets?.[index] || {}).filter(Boolean).length
}

function buildCompletedSetState(setCount = 1, done = true) {
  return Object.fromEntries(
    Array.from({ length: Math.max(1, setCount) }, (_, index) => [index + 1, done]),
  )
}

function formatDurationClock(seconds = 0) {
  const totalSeconds = Math.max(0, Math.floor(numberOrZero(seconds)))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function normalizeRows(rows = []) {
  return Array.isArray(rows) ? rows : []
}

function normalizeExerciseKey(name = '') {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeExerciseSecondaryMuscles(value = []) {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(',')

  return Array.from(new Set(
    values
      .map(item => String(item || '').trim())
      .filter(Boolean),
  ))
}

function sanitizeExerciseLibrary(entries = []) {
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

function mergeExerciseLibrary(customEntries = []) {
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

function buildExerciseMetaMap(entries = []) {
  return entries.reduce((map, entry) => {
    map[normalizeExerciseKey(entry.name)] = entry
    return map
  }, {})
}

function dateDaysAgo(days) {
  const base = new Date(`${today()}T00:00:00`)
  base.setDate(base.getDate() - days)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

function sortNewest(rows = []) {
  return [...rows].sort((a, b) => {
    const dateCompare = String(b.date || '').localeCompare(String(a.date || ''))
    if (dateCompare) return dateCompare
    return Number(b.createdAt || 0) - Number(a.createdAt || 0)
  })
}

function revokeObjectUrl(value = '') {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    URL.revokeObjectURL(value)
  }
}

function sortOldest(rows = []) {
  return [...rows].sort((a, b) => {
    const dateCompare = String(a.date || '').localeCompare(String(b.date || ''))
    if (dateCompare) return dateCompare
    return Number(a.createdAt || 0) - Number(b.createdAt || 0)
  })
}

function numberOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function roundToNearest(value, step = 5) {
  const safeStep = Math.max(1, numberOrZero(step) || 1)
  return Math.round(numberOrZero(value) / safeStep) * safeStep
}

function formatNumber(value, maximumFractionDigits = 0) {
  return numberOrZero(value).toLocaleString('en-PH', { maximumFractionDigits })
}

function formatMonthLabel(monthKey = today().slice(0, 7)) {
  const [year, month] = String(monthKey || '').split('-').map(Number)
  if (!year || !month) return 'This month'
  return new Date(year, month - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}

function getReferenceBodyWeight(bodyLogs = [], settings = {}) {
  const latestBody = normalizeRows(bodyLogs).find(row => numberOrZero(row.weight) > 0)
  if (latestBody?.weight) return numberOrZero(latestBody.weight)
  return numberOrZero(settings?.baseline?.currentWeight)
}

function getRecompProteinGoal(weight = 0, unit = 'kg') {
  const rawWeight = numberOrZero(weight)
  const kg = unit === 'lb' ? rawWeight * 0.45359237 : rawWeight
  if (!kg) return 120
  return Math.max(110, Math.min(180, roundToNearest(kg * 1.8, 5)))
}

function getRecompStarterDefaults(bodyLogs = [], settings = {}) {
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

function normalizePrimaryGoal(goal = '') {
  const normalized = String(goal || '').trim().toLowerCase()
  if (normalized === 'recomp') return 'recomp'
  if (normalized === 'lose weight') return 'lose-fat'
  if (normalized === 'gain muscle') return 'gain-muscle'
  if (normalized === 'get stronger') return 'strength'
  if (normalized === 'move more') return 'move-more'
  return 'consistency'
}

function getNutritionMode(settings = {}) {
  const macroStyle = String(settings?.meals?.macroStyle || '').trim().toLowerCase()
  if (macroStyle === 'cutting') return 'cutting'
  if (macroStyle === 'bulking') return 'bulking'
  if (macroStyle === 'recomp') return 'recomp'
  if (macroStyle === 'high protein') return 'high-protein'
  return 'balanced'
}

function getRecoveryState(score = 0, total = HABIT_OPTIONS.length) {
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

function getWeightTrendSummary(bodyLogs = [], unit = 'kg') {
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

function getTemplateForSessionKey(sessionKey = 'beginner', settings = {}, beginnerTemplate = BUILT_IN_ROUTINES[0]) {
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

function getGoalDefaultSessionKey(settings = {}, options = {}) {
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

function getGoalLabel(goalKey = 'consistency') {
  return {
    recomp: 'Recomp',
    'lose-fat': 'Lose fat',
    'gain-muscle': 'Gain muscle',
    strength: 'Get stronger',
    'move-more': 'Move more',
    consistency: 'Build consistency',
  }[goalKey] || 'Build consistency'
}

function estimateOneRepMax(weight = 0, reps = 0) {
  const load = numberOrZero(weight)
  const count = numberOrZero(reps)
  if (!load || !count) return 0
  return load * (1 + (Math.min(count, 12) / 30))
}

function hydrateExerciseRows(rows = []) {
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

function sanitizeExerciseRows(rows = []) {
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

function getExerciseTotals(exercises = []) {
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

function formatExerciseLine(row = {}, hidden = false, weightUnit = 'kg') {
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

function buildExerciseHistoryMap(workouts = []) {
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

function buildExerciseAnalytics(workouts = [], exerciseMetaMap = {}) {
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

function buildMonthlyReport(workouts = [], activities = [], bodyLogs = [], exerciseMetaMap = {}, monthKey = today().slice(0, 7)) {
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

function buildYearInReview(workouts = [], activities = [], bodyLogs = [], exerciseMetaMap = {}, yearKey = today().slice(0, 4)) {
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

function formatPreviousExerciseSummary(entry = {}, weightUnit = 'kg') {
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

function getRoutineGroupLabel(routine = {}) {
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

function groupRoutinesByLabel(routines = []) {
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

function displayMetric(value, unit = '', hidden = false, decimals = 1) {
  if (hidden) return unit ? `... ${unit}` : '...'
  const numeric = Number(value) || 0
  return `${numeric.toLocaleString('en-PH', { maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ''}`
}

function calculateBmi(weight, height, weightUnit = 'kg', bodyUnit = 'cm') {
  const rawWeight = numberOrZero(weight)
  const rawHeight = numberOrZero(height)
  if (!rawWeight || !rawHeight) return 0
  const kg = weightUnit === 'lb' ? rawWeight * 0.45359237 : rawWeight
  const meters = bodyUnit === 'in' ? rawHeight * 0.0254 : rawHeight / 100
  if (!meters) return 0
  return kg / (meters * meters)
}

function getBmiLabel(bmi) {
  if (!bmi) return 'Add height'
  if (bmi < 18.5) return 'Under range'
  if (bmi < 25) return 'Healthy range'
  if (bmi < 30) return 'Above range'
  return 'High range'
}

function getLastDateKeys(days = 7) {
  return Array.from({ length: days }, (_, index) => dateDaysAgo(days - 1 - index))
}

function addMonths(monthKey, delta) {
  const [year, month] = String(monthKey || today().slice(0, 7)).split('-').map(Number)
  const base = new Date(year || new Date().getFullYear(), (month || 1) - 1 + delta, 1)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
}

function getMonthDays(monthKey) {
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

function createDateMap(rows = []) {
  return normalizeRows(rows).reduce((map, row) => {
    const key = row.date
    if (!key) return map
    if (!map[key]) map[key] = []
    map[key].push(row)
    return map
  }, {})
}

function calculateWorkoutStreak(workouts = []) {
  const dates = new Set(workouts.map(row => row.date).filter(Boolean))
  let current = today()
  let streak = 0
  while (dates.has(current)) {
    streak += 1
    current = dateDaysAgo(streak)
  }
  return streak
}

function getPersonalRecords(workouts = [], activities = []) {
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

function getBeginnerProgression(workouts = [], settings = {}) {
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

function getHabitScore(row = {}) {
  return HABIT_OPTIONS.reduce((score, option) => score + (row[option.key] ? 1 : 0), 0)
}

function MiniBarChart({ title, rows, unit = '', hidden = false, color = 'var(--accent)' }) {
  const maxValue = Math.max(1, ...rows.map(row => numberOrZero(row.value)))
  const total = rows.reduce((sum, row) => sum + numberOrZero(row.value), 0)
  const svgH = 34
  const barW = 8
  const gap = 8
  const svgW = Math.max(120, rows.length * (barW + gap) - gap)

  return (
    <div className={lStyles.chartCard} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className={lStyles.chartTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ width: '100%', height: `${svgH}px`, maxWidth: `${rows.length * 20}px` }}
          preserveAspectRatio="none"
          aria-hidden="true"
          className={lStyles.svgBarChart}
        >
          {rows.map((row, index) => {
            const pct = numberOrZero(row.value) / maxValue
            const barH = Math.max(2, pct * svgH)
            const x = index * (barW + gap) + (svgW - (rows.length * (barW + gap) - gap)) / 2
            const y = svgH - barH
            return (
              <rect
                key={row.key}
                x={x} y={y} width={barW} height={barH} rx={2}
                fill={color}
                opacity={pct < 0.05 ? 0.15 : 0.85}
                className={lStyles.svgBarRect}
              />
            )
          })}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: `${rows.length * 20}px`, marginTop: '6px' }}>
          {rows.map((row) => (
            <span key={row.key} style={{ flex: 1, textAlign: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text3)', transform: 'scale(0.85)' }}>
              {row.label}
            </span>
          ))}
        </div>
      </div>
      <div className={lStyles.chartMeta}>
        {hidden ? 'Private' : `${formatNumber(total, 1)} ${unit}`.trim()}
      </div>
    </div>
  )
}

function SvgSparkLine({ title, rows, unit = '', hidden = false, color = 'var(--accent)', showArea = true }) {
  if (!rows.length) return null
  const values = rows.map(row => numberOrZero(row.value))
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = Math.max(1, maxVal - minVal)
  const W = 200
  const H = 34
  const pad = 8

  const toX = index => pad + (index / Math.max(1, rows.length - 1)) * (W - pad * 2)
  const toY = value => H - 4 - ((value - minVal) / range) * (H - pad - 4)

  const points = rows.map((row, index) => `${toX(index)},${toY(numberOrZero(row.value))}`)
  const polyline = points.join(' ')
  const lastVal = values[values.length - 1]
  const firstVal = values[0]
  const delta = lastVal - firstVal
  const deltaLabel = delta > 0 ? `+${formatNumber(delta, 1)}` : formatNumber(delta, 1)
  const areaPath = rows.length > 1
    ? `M${toX(0)},${H} L${points[0]} ${rows.slice(1).map((_, i) => `L${points[i + 1]}`).join(' ')} L${toX(rows.length - 1)},${H} Z`
    : ''

  return (
    <div className={lStyles.chartCard} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className={lStyles.chartTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: `${H}px` }}
          preserveAspectRatio="none"
          aria-hidden="true"
          className={lStyles.svgSparkLine}
        >
          {showArea && areaPath && (
            <path d={areaPath} fill={color} opacity="0.1" />
          )}
          {rows.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', paddingRight: '8px', marginTop: '6px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text3)', transform: 'scale(0.85)', transformOrigin: 'left center' }}>{rows[0]?.label}</span>
          {rows.length > 2 && (
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text3)', transform: 'scale(0.85)' }}>{rows[Math.floor(rows.length / 2)]?.label}</span>
          )}
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text3)', transform: 'scale(0.85)', transformOrigin: 'right center' }}>{rows[rows.length - 1]?.label}</span>
        </div>
      </div>
      <div className={lStyles.chartMeta}>
        {hidden
          ? 'Private'
          : rows.length > 1
            ? `${formatNumber(lastVal, 1)} ${unit} · ${delta !== 0 ? deltaLabel : 'steady'}`
            : `${formatNumber(lastVal, 1)} ${unit}`}
      </div>
    </div>
  )
}

function HabitHeatmap({ title, rows, hidden = false }) {
  const max = Math.max(1, ...rows.map(row => numberOrZero(row.value)))
  return (
    <div className={lStyles.chartCard}>
      <div className={lStyles.chartTitle}>{title}</div>
      <div className={lStyles.heatmapRow} aria-hidden="true">
        {rows.map(row => {
          const pct = numberOrZero(row.value) / max
          return (
            <div
              key={row.key}
              className={lStyles.heatmapCell}
              style={{ opacity: hidden ? 0.3 : Math.max(0.1, pct) }}
              title={hidden ? 'Private' : `${row.label}: ${row.value}`}
            />
          )
        })}
      </div>
      <div className={lStyles.heatmapLabels} aria-hidden="true">
        {rows.filter((_, i) => i === 0 || i === rows.length - 1 || i === Math.floor(rows.length / 2)).map(row => (
          <span key={`hl-${row.key}`}>{row.label}</span>
        ))}
      </div>
      <div className={lStyles.chartMeta}>
        {hidden ? 'Private' : `${rows.filter(r => numberOrZero(r.value) > 0).length} of ${rows.length} days`}
      </div>
    </div>
  )
}

function playTick() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {
    console.warn('Audio tick failed:', e);
  }
}

function ConsistencyHeatmap({ workouts = [], habits = [], privacyMode = false }) {
  const data = useMemo(() => {
    const dataMap = {};
    
    workouts.forEach(w => {
      if (w.date) {
        dataMap[w.date] = (dataMap[w.date] || 0) + 3;
      }
    });
    
    habits.forEach(h => {
      if (h.date) {
        let score = 0;
        HABIT_OPTIONS.forEach(opt => {
          if (h[opt.key]) score += 1;
        });
        dataMap[h.date] = (dataMap[h.date] || 0) + score;
      }
    });
    
    const list = [];
    const todayDate = new Date();
    const daysToShow = 365;
    const startDay = new Date();
    startDay.setDate(todayDate.getDate() - (daysToShow - 1));
    const startDayOfWeek = startDay.getDay();
    
    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const val = dataMap[dateStr] || 0;
      list.push({
        date: dateStr,
        value: val,
        dayOfWeek: d.getDay(),
        month: d.getMonth(),
        dayOfMonth: d.getDate(),
        year
      });
    }
    return { list, startDayOfWeek };
  }, [workouts, habits]);

  const { list, startDayOfWeek } = data;
  const cellS = 10;
  const cellGap = 2;
  const weekW = cellS + cellGap;
  const columnsCount = Math.ceil((list.length + startDayOfWeek) / 7);
  const svgW = columnsCount * weekW + 20;
  const svgH = 7 * weekW + 15;

  const activeDays = list.filter(d => d.value > 0).length;
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  list.forEach(day => {
    if (day.value > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  });
  currentStreak = tempStreak;

  const rects = list.map((day, i) => {
    const col = Math.floor((i + startDayOfWeek) / 7);
    const row = (i + startDayOfWeek) % 7;
    const x = col * weekW + 15;
    const y = row * weekW + 10;
    
    let color = 'rgba(255, 255, 255, 0.05)';
    if (!privacyMode && day.value > 0) {
      if (day.value <= 2) color = 'color-mix(in srgb, var(--accent) 30%, transparent)';
      else if (day.value <= 4) color = 'color-mix(in srgb, var(--accent) 55%, transparent)';
      else if (day.value <= 6) color = 'color-mix(in srgb, var(--accent) 80%, transparent)';
      else color = 'var(--accent)';
    } else if (privacyMode && day.value > 0) {
      color = 'rgba(255, 255, 255, 0.15)';
    }

    const labelText = privacyMode 
      ? 'Private activity check-in'
      : `${day.date}: ${day.value} activity points`;

    return (
      <rect
        key={day.date}
        x={x}
        y={y}
        width={cellS}
        height={cellS}
        fill={color}
        className={lStyles.heatmapRect}
      >
        <title>{labelText}</title>
      </rect>
    );
  });

  const monthLabels = [];
  let lastMonth = -1;
  list.forEach((day, i) => {
    if (day.month !== lastMonth) {
      const col = Math.floor((i + startDayOfWeek) / 7);
      const x = col * weekW + 15;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (x < svgW - 30) {
        monthLabels.push(
          <text key={day.date} x={x} y={8} className={lStyles.heatmapText} fontSize="8">
            {monthNames[day.month]}
          </text>
        );
      }
      lastMonth = day.month;
    }
  });

  return (
    <div className={lStyles.chartCard}>
      <div className={lStyles.chartTitle}>Annual Consistency</div>
      <div className={lStyles.annualHeatmapContainer}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className={lStyles.annualHeatmapSvg} width={svgW} height={svgH}>
          <text x={0} y={10 + 1 * weekW} className={lStyles.heatmapText} fontSize="8">Mon</text>
          <text x={0} y={10 + 3 * weekW} className={lStyles.heatmapText} fontSize="8">Wed</text>
          <text x={0} y={10 + 5 * weekW} className={lStyles.heatmapText} fontSize="8">Fri</text>
          {monthLabels}
          {rects}
        </svg>
      </div>
      <div className={lStyles.heatmapLegend}>
        <span>Less</span>
        <div className={lStyles.heatmapLegendGrid}>
          <div className={lStyles.heatmapLegendCell} style={{ background: 'rgba(255, 255, 255, 0.05)' }} />
          <div className={lStyles.heatmapLegendCell} style={{ background: 'color-mix(in srgb, var(--accent) 30%, transparent)' }} />
          <div className={lStyles.heatmapLegendCell} style={{ background: 'color-mix(in srgb, var(--accent) 55%, transparent)' }} />
          <div className={lStyles.heatmapLegendCell} style={{ background: 'color-mix(in srgb, var(--accent) 80%, transparent)' }} />
          <div className={lStyles.heatmapLegendCell} style={{ background: 'var(--accent)' }} />
        </div>
        <span>More</span>
      </div>
      <div className={lStyles.chartMeta} style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Active days: {privacyMode ? 'Private' : `${activeDays} / 365`}</span>
        <span>Longest streak: {privacyMode ? 'Private' : `${longestStreak} days`}</span>
        <span>Current: {privacyMode ? 'Private' : `${currentStreak} days`}</span>
      </div>
    </div>
  );
}

function InteractiveRoadmap({ workouts = [], onLakasTabChange = () => {}, privacyMode = false }) {
  const [expandedPhase, setExpandedPhase] = useState(null);
  
  const foundationWorkouts = useMemo(() => {
    const beginnerTemplateNames = ['Foundation A', 'Foundation B', 'Foundation C', 'Beginner A', 'Beginner B'];
    return workouts.filter(workout => {
      const name = `${workout.title || ''} ${workout.routineName || ''}`.toLowerCase();
      return beginnerTemplateNames.some(templateName => name.includes(templateName.toLowerCase()));
    });
  }, [workouts]);
  
  const completed = foundationWorkouts.length;
  const currentPhaseIndex = completed < 4 ? 0 : completed < 8 ? 1 : 2;
  
  const phases = [
    {
      title: 'Weeks 1-2: Learn the moves',
      desc: 'Focus on perfect form, control, and learning the patterns. Keep sets comfortable.',
      milestone: 'Complete 4 foundation sessions',
      target: 4,
      rules: [
        'Focus on smooth pain-free range of motion.',
        'Use light, comfortable weight.',
        'Stop 2-3 reps before your form breaks.'
      ]
    },
    {
      title: 'Weeks 3-4: Add one small step',
      desc: 'Introduce small increases in reps or sets while maintaining clean execution.',
      milestone: 'Complete 8 foundation sessions',
      target: 8,
      rules: [
        'Add 1-2 reps per set if the last session felt easy.',
        'Only add volume (an extra set) if recovery was fast.',
        'Keep the core tight and elbows stacked.'
      ]
    },
    {
      title: 'Weeks 5-8: Build consistency',
      desc: 'Establish a regular rhythm and begin cautious weight progression.',
      milestone: 'Establish a consistent 2-3x/week workout habit',
      target: 12,
      rules: [
        'Add small weight increments only after hitting all target reps twice.',
        'Prioritize sleep and hydration to support recovery.',
        'Take a deload week (light effort) if joints feel tired.'
      ]
    }
  ];

  const handleStepClick = (index) => {
    playTick();
    setExpandedPhase(expandedPhase === index ? null : index);
  };

  return (
    <div className={lStyles.chartCard}>
      <div className={lStyles.chartTitle}>Beginner Roadmap</div>
      <p className={lStyles.chartMeta} style={{ marginBottom: '16px' }}>
        You have logged <strong>{privacyMode ? 'Private' : completed}</strong> foundation sessions. 
        {completed < 8 ? ' Keep building your base!' : ' Foundation built, nice job!'}
      </p>
      <div className={lStyles.roadmapTimeline}>
        {phases.map((phase, index) => {
          const isCompleted = completed >= phase.target || (index === 0 && completed >= 4) || (index === 1 && completed >= 8);
          const isActive = index === currentPhaseIndex;
          const isExpanded = expandedPhase === index;
          
          let statusLabel = 'Upcoming';
          let badgeClass = lStyles.roadmapBadgeUpcoming;
          let dotClass = lStyles.roadmapDot;
          
          if (isCompleted) {
            statusLabel = 'Completed';
            badgeClass = lStyles.roadmapBadgeCompleted;
            dotClass = `${lStyles.roadmapDot} ${lStyles.roadmapDotCompleted}`;
          } else if (isActive) {
            statusLabel = 'Active';
            badgeClass = lStyles.roadmapBadgeActive;
            dotClass = `${lStyles.roadmapDot} ${lStyles.roadmapDotActive}`;
          }
          
          return (
            <div 
              key={phase.title} 
              className={`${lStyles.roadmapStep} ${isActive ? lStyles.roadmapStepActive : ''}`}
              onClick={() => handleStepClick(index)}
              style={{ cursor: 'pointer' }}
            >
              <div className={dotClass} />
              <div className={lStyles.roadmapHeader}>
                <span className={lStyles.roadmapTitle}>{phase.title}</span>
                <span className={`${lStyles.roadmapBadge} ${badgeClass}`}>{statusLabel}</span>
              </div>
              <p className={lStyles.roadmapDesc}>{phase.desc}</p>
              
              {isExpanded && (
                <div className={lStyles.roadmapDetails} onClick={(e) => e.stopPropagation()}>
                  <div className={lStyles.roadmapMilestone}>
                    🎯 Milestone: {phase.milestone} 
                    {!privacyMode && ` (${Math.min(completed, phase.target)}/${phase.target})`}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px', color: 'var(--text2)' }}>
                      Core guidelines for this phase:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '3px', color: 'var(--text2)' }}>
                      {phase.rules.map(rule => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                  {isActive && (
                    <button 
                      type="button" 
                      className={lStyles.roadmapAction}
                      onClick={() => {
                        playTick();
                        onLakasTabChange('workout');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Go to workouts & start session
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Lakas({ user, data = {}, profile = {}, privacyMode = false, activeTab = 'workout', actionRequest = null, onActionHandled = () => {}, onLakasTabChange = () => {} }) {
  const initialSettings = getLakasSettings(profile)
  const [routineForm, setRoutineForm] = useState(() => createRoutineForm(initialSettings))
  const [workoutForm, setWorkoutForm] = useState(() => createWorkoutForm(initialSettings))
  const [mealForm, setMealForm] = useState(createMealForm)
  const [bodyForm, setBodyForm] = useState(createBodyForm)
  const [activityForm, setActivityForm] = useState(createActivityForm)
  const [habitForm, setHabitForm] = useState(createHabitForm)
  const [goalForm, setGoalForm] = useState(createGoalForm)
  const [reminderForm, setReminderForm] = useState(() => createReminderForm(initialSettings))
  const [settingsForm, setSettingsForm] = useState(initialSettings)
  const [exerciseLibraryDraft, setExerciseLibraryDraft] = useState(createExerciseLibraryDraft)
  const [goalProgress, setGoalProgress] = useState({})
  const [celebrationGoal, setCelebrationGoal] = useState(null)
  const [savingMeal, setSavingMeal] = useState(false)
  const [savingBody, setSavingBody] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [deletingLakasData, setDeletingLakasData] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7))
  const [selectedGymSessionKey, setSelectedGymSessionKey] = useState(() => getGoalDefaultSessionKey(initialSettings))
  const [trackView, setTrackView] = useState(() => normalizeTrackView(getTrackViewForTab(activeTab), activeTab))
  const [workoutLogOpen, setWorkoutLogOpen] = useState(false)
  const [programsOpen, setProgramsOpen] = useState(false)
  const [pathChooserOpen, setPathChooserOpen] = useState(false)
  const [gymModeSupportOpen, setGymModeSupportOpen] = useState(true)
  const [gymVideoSoundRequested, setGymVideoSoundRequested] = useState(false)
  const [gymSessionMode, setGymSessionMode] = useState({
    open: false,
    sessionKey: 'beginner',
    sessionLabel: 'Beginner program',
    templateName: 'Beginner Foundation A',
    exerciseIndex: 0,
    completed: {},
    completedSets: {},
    restUntil: null,
    restDuration: 0,
    startedAt: null,
    warmupDone: false,
    focusMode: false,
  })
  const [gymSessionNow, setGymSessionNow] = useState(Date.now())
  const [plateTargetInput, setPlateTargetInput] = useState('')
  const [pendingQuickAction, setPendingQuickAction] = useState(null)
  const savedLakasSettings = getLakasSettings(profile)
  const profileSettingsKey = JSON.stringify(profile?.lakasSettings || {})
  const savedExerciseLibrary = useMemo(() => mergeExerciseLibrary(savedLakasSettings.exerciseLibrary), [profileSettingsKey])
  const savedExerciseMetaMap = useMemo(() => buildExerciseMetaMap(savedExerciseLibrary), [savedExerciseLibrary])
  const exerciseSuggestions = useMemo(() => savedExerciseLibrary.map(entry => entry.name), [savedExerciseLibrary])
  const pendingCustomExercises = useMemo(() => sanitizeExerciseLibrary(settingsForm.exerciseLibrary), [settingsForm.exerciseLibrary])
  const pendingExerciseCount = pendingCustomExercises.length
  const mealQuickActionRef = useRef(null)
  const mealNameInputRef = useRef(null)
  const workoutLogRef = useRef(null)
  const workoutNameInputRef = useRef(null)
  const programsRef = useRef(null)
  const workoutPathRef = useRef(null)
  const handledActionTokenRef = useRef(null)
  const mealPhotoUrlsRef = useRef({})
  const bodyPhotoUrlsRef = useRef({})
  const hasInitializedHabitsRef = useRef(false)
  const [mealPhotoUrls, setMealPhotoUrls] = useState({})
  const [bodyPhotoUrls, setBodyPhotoUrls] = useState({})

  const routines = sortNewest(normalizeRows(data.lakasRoutines))
  const workouts = sortNewest(normalizeRows(data.lakasWorkouts))
  const meals = sortNewest(normalizeRows(data.lakasMeals))
  const bodyLogs = sortNewest(normalizeRows(data.lakasBodyLogs))
  const activities = sortNewest(normalizeRows(data.lakasActivities))
  const habits = sortNewest(normalizeRows(data.lakasHabits))
  const reminders = sortNewest(normalizeRows(data.lakasReminders))
  const goals = normalizeRows(data.lakasGoals)
  const visibleMeals = useMemo(() => meals.slice(0, 6), [meals])
  const visibleBodyLogs = useMemo(() => bodyLogs.slice(0, 6), [bodyLogs])
  const exerciseHistory = useMemo(() => buildExerciseHistoryMap(workouts), [workouts])
  const exerciseInsights = useMemo(() => buildExerciseAnalytics(workouts, savedExerciseMetaMap), [savedExerciseMetaMap, workouts])
  const currentMonthReport = useMemo(
    () => buildMonthlyReport(workouts, activities, bodyLogs, savedExerciseMetaMap),
    [activities, bodyLogs, savedExerciseMetaMap, workouts],
  )
  const yearInReview = useMemo(
    () => buildYearInReview(workouts, activities, bodyLogs, savedExerciseMetaMap),
    [activities, bodyLogs, savedExerciseMetaMap, workouts],
  )
  const groupedRoutines = useMemo(() => groupRoutinesByLabel(routines), [routines])
  const groupedBuiltInRoutines = useMemo(() => groupRoutinesByLabel(BUILT_IN_ROUTINES), [])
  const beginnerProgression = useMemo(() => getBeginnerProgression(workouts, savedLakasSettings), [workouts, profileSettingsKey])
  const beginnerNextTemplate = BUILT_IN_ROUTINES.find(template => template.name === beginnerProgression.nextTemplateName) || BUILT_IN_ROUTINES[0]
  const recompStarterTemplates = useMemo(() => {
    const preferredNames = getPreferredTrainingTrack(savedLakasSettings) === 'home'
      ? ['Recomp Home A', 'Recomp Home B']
      : ['Recomp Starter A', 'Recomp Starter B']
    return preferredNames
      .map(name => BUILT_IN_ROUTINES.find(template => template.name === name))
      .filter(Boolean)
  }, [profileSettingsKey])
  const recompDefaults = useMemo(
    () => getRecompStarterDefaults(bodyLogs, savedLakasSettings),
    [bodyLogs, profileSettingsKey],
  )
  const recompReferenceWeight = getReferenceBodyWeight(bodyLogs, savedLakasSettings)
  const selectedGymSession = GYM_SESSION_TYPES.find(session => session.key === selectedGymSessionKey) || GYM_SESSION_TYPES[0]
  const selectedGymTemplate = getTemplateForSessionKey(selectedGymSession.key, savedLakasSettings, beginnerNextTemplate)
  const selectedGymExercises = normalizeRows(selectedGymTemplate?.exercises)
  const selectedGymEstimate = selectedGymTemplate?.duration || estimateRoutineMinutes(selectedGymTemplate?.exercises)
  const activeGymSession = GYM_SESSION_TYPES.find(session => session.key === gymSessionMode.sessionKey) || {
    ...selectedGymSession,
    label: gymSessionMode.sessionLabel || selectedGymSession.label,
    templateName: gymSessionMode.templateName || selectedGymTemplate.name,
  }
  const activeGymTemplate = BUILT_IN_ROUTINES.find(template => template.name === (gymSessionMode.templateName || activeGymSession.templateName)) || selectedGymTemplate
  const activeGymExercises = normalizeRows(activeGymTemplate?.exercises)
  const activeGymExerciseIndex = Math.min(gymSessionMode.exerciseIndex, Math.max(0, activeGymExercises.length - 1))
  const activeGymExercise = activeGymExercises[activeGymExerciseIndex] || {}
  const nextGymExercise = activeGymExercises[activeGymExerciseIndex + 1] || null
  const activeGymVideo = getExerciseVideoGuide(activeGymExercise.name)
  const activeGymGuide = getExerciseGuide(activeGymExercise.name)
  const activeGymSetCount = getExerciseSetCount(activeGymExercise)
  const activeGymCompletedSets = gymSessionMode.completedSets?.[activeGymExerciseIndex] || {}
  const activeWorkoutExercise = workoutForm.exercises[activeGymExerciseIndex] || {}
  const activeGymHistory = exerciseHistory[normalizeExerciseKey(activeGymExercise.name)]
  const activeGymAnalytic = exerciseInsights.exercises.find(entry => entry.key === normalizeExerciseKey(activeGymExercise.name))
  const activeGymPB = activeGymAnalytic ? numberOrZero(activeGymAnalytic.bestWeight) : 0
  const activeGymHasNewPR = activeGymPB > 0 && numberOrZero(activeWorkoutExercise.weight) > activeGymPB
  const activeGymDoneSets = Object.values(activeGymCompletedSets).filter(Boolean).length
  const activeGymCompletedCount = activeGymExercises.reduce((count, exercise, index) => {
    const doneSets = getCompletedSetCount(gymSessionMode.completedSets, index)
    const isComplete = Boolean(gymSessionMode.completed?.[index]) || doneSets >= getExerciseSetCount(exercise)
    return count + (isComplete ? 1 : 0)
  }, 0)
  const activeGymPlanMinutes = activeGymTemplate?.duration || estimateRoutineMinutes(activeGymExercises)
  const activeGymTotalSets = activeGymExercises.reduce((sum, exercise) => sum + getExerciseSetCount(exercise), 0)
  const activeGymDoneSetCount = activeGymExercises.reduce((sum, exercise, index) => {
    const completedForExercise = getCompletedSetCount(gymSessionMode.completedSets, index)
    return sum + (gymSessionMode.completed?.[index] ? getExerciseSetCount(exercise) : completedForExercise)
  }, 0)
  const activeGymElapsedSeconds = gymSessionMode.startedAt
    ? Math.max(0, Math.floor((gymSessionNow - gymSessionMode.startedAt) / 1000))
    : 0
  const activeGymRestRemaining = gymSessionMode.restUntil
    ? Math.max(0, Math.ceil((gymSessionMode.restUntil - gymSessionNow) / 1000))
    : 0
  const activeGymProgress = activeGymExercises.length
    ? Math.round((activeGymCompletedCount / activeGymExercises.length) * 100)
    : 0
  const activeGymFinished = activeGymExercises.length > 0 && activeGymCompletedCount >= activeGymExercises.length
  const beginnerNextSession = {
    key: 'beginner-guided',
    label: 'Beginner program',
    templateName: beginnerNextTemplate.name,
    desc: 'Guided foundation progression.',
  }

  useEffect(() => {
    setSettingsForm(getLakasSettings(profile))
  }, [profileSettingsKey])

  useEffect(() => {
    if (habits.length && !hasInitializedHabitsRef.current) {
      const todayHabit = habits.find(h => h.date === today())
      if (todayHabit) {
        setHabitForm({
          date: today(),
          water: Boolean(todayHabit.water),
          waterGlasses: numberOrZero(todayHabit.waterGlasses),
          protein: Boolean(todayHabit.protein),
          sleep: Boolean(todayHabit.sleep),
          stretching: Boolean(todayHabit.stretching),
          restDay: Boolean(todayHabit.restDay),
          vitamins: Boolean(todayHabit.vitamins),
          notes: todayHabit.notes || '',
        })
      }
      hasInitializedHabitsRef.current = true
    }
  }, [habits])

  useEffect(() => {
    if (!gymSessionMode.open) return undefined

    setGymSessionNow(Date.now())
    const timerId = window.setInterval(() => setGymSessionNow(Date.now()), 1000)
    return () => window.clearInterval(timerId)
  }, [gymSessionMode.open, gymSessionMode.startedAt])

  useEffect(() => {
    if (!gymSessionMode.open) {
      setGymVideoSoundRequested(false)
      return
    }

    setGymVideoSoundRequested(false)
  }, [gymSessionMode.open, gymSessionMode.startedAt, activeGymExerciseIndex, activeGymVideo?.id])

  useEffect(() => {
    setTrackView(current => {
      if (activeTab === 'body' && VALID_LAKAS_TRACK_VIEWS.has(current)) {
        return current
      }
      const next = normalizeTrackView(getTrackViewForTab(activeTab), activeTab)
      return current === next ? current : next
    })
  }, [activeTab])

  useEffect(() => {
    if (activeGymExercise) {
      const w = numberOrZero(activeGymExercise.weight)
      setPlateTargetInput(w > 0 ? String(w) : '60')
    }
  }, [activeGymExerciseIndex, activeGymExercise?.name])

  useEffect(() => {
    if (!gymSessionMode.open) return undefined

    const previousOverflow = document.body.style.overflow
    function handleKeyDown(event) {
      if (event.key === 'Escape') closeGymSessionMode()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [gymSessionMode.open])

  // Trigger audio/haptic feedback when rest timer completes
  const prevRestRemainingRef = useRef(0)
  useEffect(() => {
    if (prevRestRemainingRef.current > 0 && activeGymRestRemaining === 0 && gymSessionMode.open) {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200])
      }
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const now = audioCtx.currentTime
        const playNote = (frequency, delay, duration) => {
          const osc = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.connect(gain)
          gain.connect(audioCtx.destination)
          osc.type = 'sine'
          osc.frequency.setValueAtTime(frequency, now + delay)
          gain.gain.setValueAtTime(0, now + delay)
          gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration)
          osc.start(now + delay)
          osc.stop(now + delay + duration)
        }
        playNote(523.25, 0.0, 0.6)  // C5
        playNote(659.25, 0.1, 0.6)  // E5
        playNote(783.99, 0.2, 0.8)  // G5
        playNote(1046.50, 0.3, 1.0) // C6
      } catch (e) {
        console.warn('Web Audio chime failed:', e)
      }
    }
    prevRestRemainingRef.current = activeGymRestRemaining
  }, [activeGymRestRemaining, gymSessionMode.open])

  const insights = useMemo(() => {
    const weekStart = dateDaysAgo(6)
    const lastSevenDays = getLastDateKeys(7)
    const workoutsThisWeek = workouts.filter(row => row.date >= weekStart).length
    const todaysMeals = meals.filter(row => row.date === today())
    const caloriesToday = todaysMeals.reduce((sum, row) => sum + numberOrZero(row.calories), 0)
    const proteinToday = todaysMeals.reduce((sum, row) => sum + numberOrZero(row.protein), 0)
    const latestBody = bodyLogs.find(row => numberOrZero(row.weight) > 0 || numberOrZero(row.waist) > 0) || {}
    const latestWeight = latestBody.weight || 0
    const latestBmi = calculateBmi(latestBody.weight, latestBody.height, savedLakasSettings.units.weight, savedLakasSettings.units.body)
    const todayActivity = activities.find(row => row.date === today()) || {}
    const todayHabit = habits.find(row => row.date === today()) || {}
    const activeGoals = goals.filter(goal => {
      let resolvedCurrent = numberOrZero(goal.current)
      const typeLower = String(goal.type || '').toLowerCase()
      const nameLower = String(goal.name || '').toLowerCase()
      if (typeLower === 'steps') {
        resolvedCurrent = numberOrZero(todayActivity.steps)
      } else if (typeLower === 'workout' || typeLower === 'workouts') {
        if (nameLower.includes('week') || String(goal.unit || '').toLowerCase().includes('week')) {
          resolvedCurrent = workoutsThisWeek
        } else {
          resolvedCurrent = workouts.length
        }
      } else if (typeLower === 'calories') {
        resolvedCurrent = caloriesToday
      } else if (typeLower === 'protein') {
        resolvedCurrent = proteinToday
      } else if (typeLower === 'weight') {
        resolvedCurrent = latestWeight
      } else if (typeLower === 'habit' || typeLower === 'habits') {
        resolvedCurrent = getHabitScore(todayHabit)
      }
      return resolvedCurrent < numberOrZero(goal.target)
    }).length
    const activeDays = new Set([
      ...workouts.filter(row => row.date >= weekStart).map(row => row.date),
      ...activities.filter(row => row.date >= weekStart && (
        numberOrZero(row.steps) || numberOrZero(row.cardioMinutes) || numberOrZero(row.walkingMinutes) || numberOrZero(row.activeMinutes)
      )).map(row => row.date),
    ]).size
    const volumeByDay = lastSevenDays.map(day => ({
      key: day,
      label: day.slice(8),
      value: workouts.filter(row => row.date === day).reduce((sum, row) => sum + (numberOrZero(row.volume) || getExerciseTotals(row.exercises).volume), 0),
    }))
    const stepsByDay = lastSevenDays.map(day => ({
      key: day,
      label: day.slice(8),
      value: activities.filter(row => row.date === day).reduce((sum, row) => sum + numberOrZero(row.steps), 0),
    }))
    const workoutFrequency = lastSevenDays.map(day => ({
      key: day,
      label: day.slice(8),
      value: workouts.filter(row => row.date === day).length,
    }))
    const weightTrend = sortOldest(bodyLogs.filter(row => numberOrZero(row.weight) > 0)).slice(-7).map(row => ({
      key: row._id || row.date,
      label: row.date?.slice(5) || '',
      value: numberOrZero(row.weight),
    }))
    const records = getPersonalRecords(workouts, activities)
    const caloriesByDay = lastSevenDays.map(day => ({
      key: day,
      label: day.slice(8),
      value: meals.filter(row => row.date === day).reduce((sum, row) => sum + numberOrZero(row.calories), 0),
    }))
    const proteinByDay = lastSevenDays.map(day => ({
      key: day,
      label: day.slice(8),
      value: meals.filter(row => row.date === day).reduce((sum, row) => sum + numberOrZero(row.protein), 0),
    }))
    const habitByDay = lastSevenDays.map(day => {
      const h = habits.find(row => row.date === day) || {}
      return { key: day, label: day.slice(8), value: getHabitScore(h) }
    })

    return {
      workoutsThisWeek,
      caloriesToday,
      proteinToday,
      latestWeight,
      latestBmi,
      activeGoals,
      routineCount: routines.length,
      stepsToday: numberOrZero(todayActivity.steps),
      activeMinutesToday: numberOrZero(todayActivity.activeMinutes) + numberOrZero(todayActivity.cardioMinutes) + numberOrZero(todayActivity.walkingMinutes),
      habitScoreToday: getHabitScore(todayHabit),
      waterGlassesToday: numberOrZero(todayHabit.waterGlasses),
      activeDays,
      volumeByDay,
      stepsByDay,
      workoutFrequency,
      weightTrend,
      caloriesByDay,
      proteinByDay,
      habitByDay,
      records,
    }
  }, [activities, bodyLogs, goals, habits, meals, profileSettingsKey, routines.length, savedLakasSettings.units.body, savedLakasSettings.units.weight, workouts])

  const resolvedGoals = useMemo(() => {
    return goals.map(goal => {
      let resolvedCurrent = numberOrZero(goal.current)
      const typeLower = String(goal.type || '').toLowerCase()
      const nameLower = String(goal.name || '').toLowerCase()
      
      if (typeLower === 'steps') {
        resolvedCurrent = insights.stepsToday
      } else if (typeLower === 'workout' || typeLower === 'workouts') {
        if (nameLower.includes('week') || String(goal.unit || '').toLowerCase().includes('week')) {
          resolvedCurrent = insights.workoutsThisWeek
        } else {
          resolvedCurrent = workouts.length
        }
      } else if (typeLower === 'calories') {
        resolvedCurrent = insights.caloriesToday
      } else if (typeLower === 'protein') {
        resolvedCurrent = insights.proteinToday
      } else if (typeLower === 'weight') {
        resolvedCurrent = insights.latestWeight
      } else if (typeLower === 'habit' || typeLower === 'habits') {
        resolvedCurrent = insights.habitScoreToday
      }
      
      return {
        ...goal,
        current: resolvedCurrent,
      }
    })
  }, [goals, insights, workouts.length])

  const almostDoneGoals = useMemo(() => {
    return resolvedGoals.filter(goal => {
      const target = numberOrZero(goal.target)
      const current = numberOrZero(goal.current)
      if (target <= 0) return false
      const pct = (current / target) * 100
      return pct >= 80 && pct < 100
    })
  }, [resolvedGoals])

  // Confetti/Celebration trigger on goal achievement
  const celebratedGoalsRef = useRef(new Set())
  useEffect(() => {
    if (!goals.length) return
    let timerId = null
    resolvedGoals.forEach(goal => {
      const target = numberOrZero(goal.target)
      const current = numberOrZero(goal.current)
      if (target > 0 && current >= target) {
        if (!celebratedGoalsRef.current.has(goal._id)) {
          celebratedGoalsRef.current.add(goal._id)
          notifyApp({
            title: '🎉 Goal Achieved!',
            message: `Congratulations! You hit your goal: "${goal.name}" (${current}/${target} ${goal.unit || ''})`,
            tone: 'success'
          })
          setCelebrationGoal(goal)
          timerId = setTimeout(() => {
            setCelebrationGoal(null)
          }, 8000)
        }
      } else {
        celebratedGoalsRef.current.delete(goal._id)
      }
    })
    return () => {
      if (timerId) clearTimeout(timerId)
    }
  }, [resolvedGoals, goals.length])

  const coachingSystem = useMemo(() => {
    const primaryGoalKey = normalizePrimaryGoal(savedLakasSettings.baseline.goal)
    const goalLabel = getGoalLabel(primaryGoalKey)
    const preferredTrack = getPreferredTrainingTrack(savedLakasSettings)
    const preferredWorkoutPlace = preferredTrack === 'home' ? 'Home or low equipment' : 'Gym or full equipment'
    const nutritionMode = getNutritionMode(savedLakasSettings)
    const recoveryState = getRecoveryState(insights.habitScoreToday, HABIT_OPTIONS.length)
    const recommendedSessionKey = getGoalDefaultSessionKey(savedLakasSettings, { recoveryLevel: recoveryState.level })
    const recommendedSession = GYM_SESSION_TYPES.find(session => session.key === recommendedSessionKey) || GYM_SESSION_TYPES[0]
    const recommendedTemplate = getTemplateForSessionKey(recommendedSession.key, savedLakasSettings, beginnerNextTemplate)
    const recommendedEstimate = getResolvedRoutineDuration(recommendedTemplate?.duration, recommendedTemplate?.exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    const recommendedDifficulty = recommendedTemplate?.difficulty || recommendedTemplate?.focus || 'Guided'
    const weeklyWorkoutTarget = Math.max(1, numberOrZero(savedLakasSettings.targets.workoutsPerWeek) || 3)
    const workoutsLeftThisWeek = Math.max(0, weeklyWorkoutTarget - insights.workoutsThisWeek)
    const baseCalorieTarget = numberOrZero(savedLakasSettings.targets.calories) || numberOrZero(savedLakasSettings.meals.calorieGoal) || recompDefaults.calorieGoal
    const baseProteinTarget = Math.max(
      numberOrZero(savedLakasSettings.targets.protein),
      numberOrZero(savedLakasSettings.meals.proteinGoal),
      ['recomp', 'gain-muscle', 'lose-fat', 'strength'].includes(primaryGoalKey) ? recompDefaults.proteinGoal : 0,
    ) || 120
    const caloriesRemaining = Math.max(0, baseCalorieTarget - insights.caloriesToday)
    const proteinRemaining = Math.max(0, baseProteinTarget - insights.proteinToday)
    const weightTrend = getWeightTrendSummary(bodyLogs, savedLakasSettings.units.weight)
    const selectedPathReason = selectedGymSession.key === 'beginner'
      ? beginnerProgression.nextAction
      : buildTemplateNotes(selectedGymTemplate) || selectedGymSession.desc

    let recommendedReason = buildTemplateNotes(recommendedTemplate) || recommendedSession.desc
    if (recoveryState.level === 'low') {
      recommendedReason = 'Recovery looks low today, so the safest recommendation is a lighter reset session instead of forcing intensity.'
    } else if (primaryGoalKey === 'recomp') {
      recommendedReason = 'Build muscle first, keep effort repeatable, and let walking plus nutrition tighten things up slowly.'
    } else if (primaryGoalKey === 'lose-fat') {
      recommendedReason = 'Use a repeatable full-body or conditioning day so fat loss comes from consistency, not punishment.'
    } else if (primaryGoalKey === 'gain-muscle') {
      recommendedReason = 'Use the most controllable muscle-building session available, then progress slowly from clean reps.'
    } else if (primaryGoalKey === 'strength') {
      recommendedReason = 'Choose the clearer load-bearing program today and treat technique plus repeatability as the real win.'
    } else if (primaryGoalKey === 'move-more') {
      recommendedReason = 'The best session today is the one with the lowest barrier to starting and finishing.'
    }

    let progressTitle = `${workoutsLeftThisWeek} workout${workoutsLeftThisWeek === 1 ? '' : 's'} left this week`
    let progressBody = workoutsLeftThisWeek
      ? `Hit ${weeklyWorkoutTarget} workouts this week by keeping the next session simple instead of chasing variety.`
      : 'You already hit the weekly target, so a recovery or movement day is enough to keep momentum.'

    if (proteinRemaining > 25) {
      progressTitle = `${formatNumber(proteinRemaining, 0)}g protein still open today`
      progressBody = 'Nutrition is the easiest next win right now. Close the protein gap before adding more workout complexity.'
    } else if (recoveryState.level === 'low') {
      progressTitle = 'Recovery is the limiter today'
      progressBody = 'If sleep, soreness, or stress feels off, protect tomorrow by making today lighter.'
    } else if (primaryGoalKey === 'lose-fat' && weightTrend.direction === 'up') {
      progressTitle = 'Weight trend is drifting up'
      progressBody = 'Hold calories steady, keep walking high, and avoid treating hard workouts like a reason to overeat.'
    } else if (primaryGoalKey === 'gain-muscle' && weightTrend.direction === 'down') {
      progressTitle = 'Weight trend is drifting down'
      progressBody = 'If strength feels flat too, slightly more food may help recovery better than forcing extra volume.'
    } else if (insights.workoutsThisWeek >= weeklyWorkoutTarget && recoveryState.level === 'high') {
      progressTitle = 'Consistency is holding'
      progressBody = 'Keep the same structure next week and only progress load or reps if the session still feels clean.'
    }

    const pathOptionMetaByKey = {
      beginner: beginnerProgression.phase.title,
      recovery: recoveryState.level === 'low' ? 'Best when recovery is lagging' : 'Reset without losing momentum',
      cardio: primaryGoalKey === 'move-more' || primaryGoalKey === 'lose-fat' ? 'Conditioning supports the current goal' : 'Useful on lower-energy days',
      home: preferredTrack === 'home' ? 'Best when you want a lower setup barrier' : 'Low-equipment fallback',
      'full-body': primaryGoalKey === 'recomp' ? 'Best all-around muscle-building base' : 'Simple structured weights session',
      push: primaryGoalKey === 'strength' || primaryGoalKey === 'gain-muscle' ? 'Best heavier upper-body option' : 'Structured gym session',
    }

    const pathOrder = [
      recommendedSession.key,
      selectedGymSession.key,
      preferredTrack === 'home' ? 'home' : 'full-body',
      primaryGoalKey === 'move-more' ? 'cardio' : preferredTrack === 'home' ? 'cardio' : 'push',
      'recovery',
      'beginner',
    ]

    const pathOptions = Array.from(new Set(pathOrder))
      .map(key => GYM_SESSION_TYPES.find(session => session.key === key))
      .filter(Boolean)
      .slice(0, 5)
      .map(session => ({
        key: session.key,
        title: session.label,
        meta: pathOptionMetaByKey[session.key] || session.desc,
      }))

    return {
      profile: {
        goalKey: primaryGoalKey,
        goalLabel,
        nutritionMode,
        preferredTrack,
        preferredWorkoutPlace,
        recovery: recoveryState,
      },
      workout: {
        recommendedSessionKey: recommendedSession.key,
        recommendedSession,
        recommendedTemplate,
        recommendedEstimate,
        recommendedDifficulty,
        recommendedReason,
        selectedPathReason,
        pathOptions,
      },
      nutrition: {
        calorieTarget: baseCalorieTarget,
        proteinTarget: baseProteinTarget,
        caloriesRemaining,
        proteinRemaining,
        summary: caloriesRemaining > 0
          ? `${formatNumber(caloriesRemaining, 0)} kcal and ${formatNumber(proteinRemaining, 0)}g protein still open today.`
          : `${formatNumber(proteinRemaining, 0)}g protein still open today. Keep the rest simple.`,
      },
      progress: {
        title: progressTitle,
        body: progressBody,
        weeklyWorkoutTarget,
        workoutsLeftThisWeek,
        weightTrend,
      },
    }
  }, [
    beginnerNextTemplate,
    beginnerProgression,
    bodyLogs,
    insights.caloriesToday,
    insights.habitScoreToday,
    insights.proteinToday,
    insights.workoutsThisWeek,
    profileSettingsKey,
    recompDefaults.calorieGoal,
    recompDefaults.proteinGoal,
    selectedGymSession.desc,
    selectedGymSession.key,
    selectedGymSession.label,
    selectedGymTemplate,
  ])

  const featuredWorkoutTemplate = coachingSystem.workout.recommendedTemplate
  const featuredWorkoutSession = coachingSystem.workout.recommendedSession
  const featuredWorkoutEstimate = coachingSystem.workout.recommendedEstimate
  const featuredWorkoutDifficulty = coachingSystem.workout.recommendedDifficulty
  const featuredWorkoutPlace = coachingSystem.profile.preferredWorkoutPlace
  const weeklyWorkoutTarget = coachingSystem.progress.weeklyWorkoutTarget
  const workoutsLeftThisWeek = coachingSystem.progress.workoutsLeftThisWeek
  const todayPathOptions = coachingSystem.workout.pathOptions

  const calendarData = useMemo(() => {
    const workoutMap = createDateMap(workouts)
    const activityMap = createDateMap(activities)
    const bodyMap = createDateMap(bodyLogs)
    const habitMap = createDateMap(habits)
    const days = getMonthDays(calendarMonth)
    return days.map(day => {
      if (day.empty) return day
      return {
        ...day,
        workouts: workoutMap[day.key] || [],
        activities: activityMap[day.key] || [],
        bodies: bodyMap[day.key] || [],
        habits: habitMap[day.key] || [],
      }
    })
  }, [activities, bodyLogs, calendarMonth, habits, workouts])

  function updateExerciseRow(formSetter, rowId, field, value) {
    formSetter(current => ({
      ...current,
      exercises: current.exercises.map(row => (
        row.rowId === rowId ? { ...row, [field]: value } : row
      )),
    }))
  }

  function addExerciseRow(formSetter) {
    formSetter(current => ({
      ...current,
      exercises: [...current.exercises, createExerciseRow({}, savedLakasSettings.workoutDefaults)],
    }))
  }

  function removeExerciseRow(formSetter, rowId) {
    formSetter(current => ({
      ...current,
      exercises: current.exercises.length <= 1
        ? current.exercises
        : current.exercises.filter(row => row.rowId !== rowId),
    }))
  }

  function loadRoutine(routine) {
    if (!routine) return
    const resolvedDuration = getResolvedRoutineDuration(routine.duration, routine.exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    setWorkoutForm(current => ({
      ...current,
      routineId: routine._id || '',
      title: routine.name || current.title,
      duration: resolvedDuration ? String(resolvedDuration) : current.duration,
      exercises: hydrateExerciseRows(routine.exercises),
      notes: routine.notes || current.notes,
    }))
    window.requestAnimationFrame(() => {
      safeScrollIntoView(workoutLogRef.current, { behavior: 'smooth', block: 'start' })
      workoutNameInputRef.current?.focus()
    })
    notifyApp({ title: 'Routine ready', message: `${routine.name || 'Routine'} is ready to log.`, tone: 'success' })
  }

  function openProgramsPanel() {
    setProgramsOpen(true)
    window.requestAnimationFrame(() => {
      safeScrollIntoView(programsRef.current, { behavior: 'smooth', block: 'start' })
    })
  }

  function openWorkoutPathChooser() {
    setPathChooserOpen(true)
    window.requestAnimationFrame(() => {
      safeScrollIntoView(workoutPathRef.current, { behavior: 'smooth', block: 'start' })
    })
  }

  function loadWorkoutTemplate(template = selectedGymTemplate, session = selectedGymSession) {
    if (!template) return
    const resolvedDuration = getResolvedRoutineDuration(template.duration, template.exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    setWorkoutForm(current => ({
      ...current,
      routineId: '',
      date: today(),
      title: template.name || session.label || current.title,
      duration: resolvedDuration ? String(resolvedDuration) : current.duration,
      exercises: hydrateExerciseRows(template.exercises),
      notes: [current.notes, buildTemplateNotes(template)].filter(Boolean).join(' ').trim(),
    }))
    window.requestAnimationFrame(() => {
      safeScrollIntoView(workoutLogRef.current, { behavior: 'smooth', block: 'start' })
      workoutNameInputRef.current?.focus()
    })
    notifyApp({ title: 'Workout ready', message: `${template.name || session.label || 'Workout'} is ready in the workout log.`, tone: 'success' })
  }

  function openGymSessionMode(template = selectedGymTemplate, session = selectedGymSession) {
    if (!template) return
    const resolvedDuration = getResolvedRoutineDuration(template.duration, template.exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    setGymModeSupportOpen(true)
    setWorkoutForm(current => ({
      ...current,
      routineId: '',
      date: today(),
      title: template.name || session.label,
      duration: String(resolvedDuration),
      exercises: hydrateExerciseRows(template.exercises),
      notes: [`Gym session: ${session.label}.`, buildTemplateNotes(template)].filter(Boolean).join(' '),
    }))
    setGymSessionMode({
      open: true,
      sessionKey: session.key,
      sessionLabel: session.label,
      templateName: template.name,
      exerciseIndex: 0,
      completed: {},
      completedSets: {},
      restUntil: null,
      restDuration: 0,
      startedAt: Date.now(),
      warmupDone: false,
    })
    notifyApp({ title: 'Session ready', message: `${template.name || session.label} is open in session mode.`, tone: 'success' })
  }

  function editGymSessionAsRoutine(template = selectedGymTemplate) {
    if (!template) return
    applyRoutineTemplate(template)
  }

  function closeGymSessionMode() {
    setGymSessionMode(current => ({ ...current, open: false }))
  }

  function setGymModeExercise(index) {
    setGymModeSupportOpen(true)
    setGymSessionMode(current => ({
      ...current,
      exerciseIndex: Math.max(0, Math.min(index, Math.max(0, activeGymExercises.length - 1))),
      restUntil: null,
      restDuration: 0,
    }))
  }

  function completeCurrentGymExercise() {
    setGymModeSupportOpen(true)
    setGymSessionMode(current => {
      const index = Math.max(0, Math.min(current.exerciseIndex, Math.max(0, activeGymExercises.length - 1)))
      const exercise = activeGymExercises[index] || {}
      const setCount = getExerciseSetCount(exercise)
      const wasCompleted = Boolean(current.completed?.[index])
      const completed = {
        ...(current.completed || {}),
        [index]: !wasCompleted,
      }
      const completedSets = {
        ...(current.completedSets || {}),
        [index]: buildCompletedSetState(setCount, !wasCompleted),
      }
      const nextIndex = !wasCompleted && index < activeGymExercises.length - 1
        ? index + 1
        : index

      return {
        ...current,
        completed,
        completedSets,
        exerciseIndex: nextIndex,
        restUntil: null,
        restDuration: 0,
      }
    })
  }

  function toggleGymSet(setNumber) {
    playTick()
    setGymSessionMode(current => {
      const index = Math.max(0, Math.min(current.exerciseIndex, Math.max(0, activeGymExercises.length - 1)))
      const exercise = activeGymExercises[index] || {}
      const setCount = getExerciseSetCount(exercise)
      const currentSets = current.completedSets?.[index] || {}
      const wasDone = Boolean(currentSets[setNumber])
      const nextSets = {
        ...currentSets,
        [setNumber]: !wasDone,
      }
      const doneCount = Object.values(nextSets).filter(Boolean).length
      const exerciseDone = doneCount >= setCount
      const restSeconds = Math.max(0, numberOrZero(exercise.rest))
      const shouldStartRest = !wasDone && restSeconds > 0 && !exerciseDone

      return {
        ...current,
        completedSets: {
          ...(current.completedSets || {}),
          [index]: nextSets,
        },
        completed: {
          ...(current.completed || {}),
          [index]: exerciseDone,
        },
        restUntil: shouldStartRest ? Date.now() + (restSeconds * 1000) : current.restUntil,
        restDuration: shouldStartRest ? restSeconds : current.restDuration,
      }
    })
  }

  function skipGymRest() {
    setGymSessionMode(current => ({ ...current, restUntil: null, restDuration: 0 }))
  }

  function markGymWarmupDone() {
    setGymSessionMode(current => ({ ...current, warmupDone: true }))
  }

  function resetGymWarmup() {
    setGymSessionMode(current => ({ ...current, warmupDone: false }))
  }

  function applyRoutineTemplate(template) {
    const resolvedDuration = getResolvedRoutineDuration(template.duration, template.exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    setRoutineForm({
      name: template.name,
      focus: template.focus,
      duration: String(resolvedDuration || ''),
      exercises: hydrateExerciseRows(template.exercises),
      notes: buildTemplateNotes(template),
    })
    notifyApp({ title: 'Template ready', message: `${template.name} is ready to save or edit.`, tone: 'success' })
  }

  function editRoutine(routine) {
    if (!routine) return
    const resolvedDuration = getResolvedRoutineDuration(routine.duration, routine.exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    setRoutineForm({
      name: routine.name || '',
      focus: routine.focus || 'Strength',
      duration: resolvedDuration ? String(resolvedDuration) : '',
      exercises: hydrateExerciseRows(routine.exercises),
      notes: routine.notes || '',
    })
    notifyApp({ title: 'Routine ready', message: `${routine.name || 'Routine'} is open in the builder.`, tone: 'success' })
  }

  function copyWorkoutIntoLog(workout) {
    if (!workout) return
    const resolvedDuration = getResolvedRoutineDuration(workout.duration, workout.exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    const matchingRoutine = routines.find(row => row._id === workout.routineId)
    setWorkoutForm({
      routineId: matchingRoutine?._id || '',
      date: today(),
      title: workout.title || 'Workout',
      duration: resolvedDuration ? String(resolvedDuration) : '',
      exercises: hydrateExerciseRows(workout.exercises),
      notes: workout.notes || '',
    })
    window.requestAnimationFrame(() => {
      safeScrollIntoView(workoutLogRef.current, { behavior: 'smooth', block: 'start' })
      workoutNameInputRef.current?.focus()
    })
    notifyApp({ title: 'Workout copied', message: `${workout.title || 'Workout'} is ready to log again.`, tone: 'success' })
  }

  function turnWorkoutIntoRoutine(workout) {
    if (!workout) return
    const resolvedDuration = getResolvedRoutineDuration(workout.duration, workout.exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    setRoutineForm({
      name: workout.routineName || workout.title || '',
      focus: 'Custom',
      duration: resolvedDuration ? String(resolvedDuration) : '',
      exercises: hydrateExerciseRows(workout.exercises),
      notes: workout.notes || '',
    })
    notifyApp({ title: 'Workout moved to builder', message: 'Review it and save when you want it as a routine.', tone: 'success' })
  }

  function applyPreviousExerciseValues(formSetter, rowId, historyEntry) {
    if (!historyEntry) return
    formSetter(current => ({
      ...current,
      exercises: normalizeRows(current.exercises).map(row => {
        if (row.rowId !== rowId) return row
        return {
          ...row,
          sets: historyEntry.sets ? String(historyEntry.sets) : row.sets,
          reps: historyEntry.reps ? String(historyEntry.reps) : row.reps,
          weight: historyEntry.weight ? String(historyEntry.weight) : row.weight,
          duration: historyEntry.duration ? String(historyEntry.duration) : row.duration,
          rest: historyEntry.rest || historyEntry.rest === 0 ? String(historyEntry.rest) : row.rest,
          notes: row.notes || historyEntry.notes || '',
        }
      }),
    }))
  }

  function handleRoutineSelect(routineId) {
    if (!routineId) {
      setWorkoutForm(current => ({ ...current, routineId: '' }))
      return
    }

    loadRoutine(routines.find(routine => routine._id === routineId))
  }

  function renderExerciseEditor(rows, formSetter, ariaLabel) {
    return (
      <div className={lStyles.exerciseBuilder} aria-label={ariaLabel}>
        {rows.some(row => exerciseHistory[normalizeExerciseKey(row.name)]) && (
          <div className={lStyles.editorGlobalActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                let copiedCount = 0;
                formSetter(current => {
                  const updatedExercises = current.exercises.map(row => {
                    const prev = exerciseHistory[normalizeExerciseKey(row.name)];
                    if (prev) {
                      copiedCount++;
                      return {
                        ...row,
                        sets: String(prev.sets || row.sets || ''),
                        reps: String(prev.reps || row.reps || ''),
                        weight: String(prev.weight || row.weight || ''),
                        duration: String(prev.duration || row.duration || ''),
                        rest: String(prev.rest || row.rest || ''),
                        notes: prev.notes || row.notes || '',
                      };
                    }
                    return row;
                  });
                  return { ...current, exercises: updatedExercises };
                });
                notifyApp({
                  title: 'Copy complete',
                  message: `Prefilled last session values for ${copiedCount} exercises.`,
                  tone: 'success'
                });
              }}
              style={{ marginBottom: '12px', width: '100%' }}
            >
              ⚡ Prefill All Last Session Values
            </Button>
          </div>
        )}
        {rows.map((row, index) => {
          const guide = getExerciseGuide(row.name)
          const loadHint = getExerciseLoadHint(row.name, savedLakasSettings)
          const previousEntry = exerciseHistory[normalizeExerciseKey(row.name)]
          const exerciseMeta = savedExerciseMetaMap[normalizeExerciseKey(row.name)]
          const estimatedWork = estimateExerciseMinutes({
            sets: row.sets,
            reps: row.reps,
            duration: row.duration,
            rest: row.rest,
          })
          return (
            <div key={row.rowId} className={lStyles.exerciseRow}>
              <div className={lStyles.exerciseRowTop}>
                <div className={lStyles.exerciseNameWrapper}>
                  <label className={lStyles.exerciseName}>
                    <span>Exercise {index + 1}</span>
                    <input
                      list="lakas-exercise-library"
                      value={row.name}
                      placeholder="Bench press, Squat, Treadmill"
                      onChange={event => updateExerciseRow(formSetter, row.rowId, 'name', event.target.value)}
                    />
                  </label>
                  {row.name && !savedExerciseLibrary.some(entry => normalizeExerciseKey(entry.name) === normalizeExerciseKey(row.name)) && (
                    <button
                      type="button"
                      className={lStyles.inlineAddLibBtn}
                      onClick={() => handleInlineAddExercise(row.name)}
                      title="Add this exercise to your global library"
                    >
                      + Add to Library
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeExerciseRow(formSetter, row.rowId)}
                  disabled={rows.length <= 1}
                >
                  Remove
                </Button>
              </div>
              {guide && (
                <div className={lStyles.formGuide}>
                  <strong>{guide.name} form cues</strong>
                  <span>{guide.setup}</span>
                  <span>{guide.execution}</span>
                  <small>Watch for: {guide.mistakes}</small>
                  <small>Safety: {guide.safety}</small>
                </div>
              )}
              <div className={lStyles.exerciseMetrics}>
                <label>
                  <span>Sets</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={row.sets}
                    placeholder={previousEntry ? String(previousEntry.sets) : '3'}
                    onChange={event => updateExerciseRow(formSetter, row.rowId, 'sets', event.target.value)}
                  />
                </label>
                <label>
                  <span>Reps</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={row.reps}
                    placeholder={previousEntry ? String(previousEntry.reps) : '10'}
                    onChange={event => updateExerciseRow(formSetter, row.rowId, 'reps', event.target.value)}
                  />
                </label>
                <label>
                  <span>Weight ({savedLakasSettings.units.weight})</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={row.weight}
                      placeholder={previousEntry ? String(previousEntry.weight) : '60'}
                      onChange={event => updateExerciseRow(formSetter, row.rowId, 'weight', event.target.value)}
                    />
                    {(() => {
                      const analytic = exerciseInsights.exercises.find(entry => entry.key === normalizeExerciseKey(row.name))
                      const pb = analytic ? numberOrZero(analytic.bestWeight) : 0
                      const cur = numberOrZero(row.weight)
                      if (pb > 0 && cur > pb) {
                        return (
                          <span className={lStyles.prBadgeInline} title="Personal Record!">
                            🏅 PR!
                          </span>
                        )
                      }
                      return null
                    })()}
                  </div>
                </label>
                <label>
                  <span>Timed work (s)</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={row.duration}
                    placeholder={previousEntry ? String(previousEntry.duration) : '0'}
                    onChange={event => updateExerciseRow(formSetter, row.rowId, 'duration', event.target.value)}
                  />
                </label>
                <label>
                  <span>Rest (s)</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={row.rest}
                    placeholder={previousEntry ? String(previousEntry.rest) : '60'}
                    onChange={event => updateExerciseRow(formSetter, row.rowId, 'rest', event.target.value)}
                  />
                </label>
              </div>
              {(loadHint || row.name) && (
                <div className={lStyles.exerciseHint}>
                  {loadHint && <span>{loadHint}</span>}
                  <small>{estimatedWork} min estimated work for this exercise. Use timed work only for holds, cardio, or timed drills.</small>
                </div>
              )}
              {row.name && (
                <div className={lStyles.exerciseIdentityCard}>
                  <div>
                    <strong>{exerciseMeta ? exerciseMeta.primaryMuscle : 'Unmapped exercise'}</strong>
                    <span>
                      {exerciseMeta
                        ? [
                          exerciseMeta.category,
                          exerciseMeta.primaryMuscle,
                          ...normalizeExerciseSecondaryMuscles(exerciseMeta.secondaryMuscles),
                        ].filter(Boolean).join(' · ')
                        : 'Add this name to your exercise library in settings to track it by muscle group and exercise history.'}
                    </span>
                  </div>
                  {exerciseMeta?.source && <small>{exerciseMeta.source}</small>}
                </div>
              )}
              {previousEntry && (
                <div className={lStyles.previousValueCard}>
                  <div>
                    <strong>Last logged</strong>
                    <span>{formatPreviousExerciseSummary(previousEntry, savedLakasSettings.units.weight)}</span>
                    <small>{previousEntry.workoutTitle} · {previousEntry.date ? formatDisplayDate(previousEntry.date) : 'Saved workout'} · {previousEntry.count} saved {previousEntry.count === 1 ? 'entry' : 'entries'}</small>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => applyPreviousExerciseValues(formSetter, row.rowId, previousEntry)}>
                    Use last values
                  </Button>
                </div>
              )}
              <label className={lStyles.exerciseNotes}>
                <span>Exercise notes</span>
                <input value={row.notes} placeholder="Warmup, RPE, form cue" onChange={event => updateExerciseRow(formSetter, row.rowId, 'notes', event.target.value)} />
              </label>
            </div>
          )
        })}
        <Button type="button" variant="secondary" fullWidth onClick={() => addExerciseRow(formSetter)}>
          Add exercise
        </Button>
      </div>
    )
  }

  function applyFoodPreset(food) {
    setMealForm(current => ({
      ...current,
      name: food.name,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fat: String(food.fat),
    }))
  }

  async function handleAddRoutine() {
    const exercises = sanitizeExerciseRows(routineForm.exercises)
    if (!routineForm.name.trim() || !exercises.length) {
      notifyApp({ title: 'Routine needs details', message: 'Add a routine name and at least one exercise.', tone: 'warning' })
      return
    }

    const totals = getExerciseTotals(exercises)
    const resolvedDuration = getResolvedRoutineDuration(routineForm.duration, exercises, savedLakasSettings.workoutDefaults.durationMinutes)
    await fsAdd(user.uid, 'lakasRoutines', {
      name: routineForm.name.trim(),
      focus: routineForm.focus,
      duration: resolvedDuration,
      exercises,
      exerciseCount: totals.exerciseCount,
      setCount: totals.setCount,
      volume: totals.volume,
      notes: routineForm.notes.trim(),
      source: 'lakas',
    })
    setRoutineForm(createRoutineForm(savedLakasSettings))
    notifyApp({ title: 'Routine saved', message: 'You can now load it when logging a workout.', tone: 'success' })
  }

  async function handleAddWorkout(overrides = {}) {
    const safeOverrides = overrides?.nativeEvent || overrides?.target ? {} : overrides
    const nextWorkout = { ...workoutForm, ...(safeOverrides || {}) }
    const exercises = sanitizeExerciseRows(nextWorkout.exercises)
    if (!String(nextWorkout.title || '').trim() || !nextWorkout.date || !exercises.length) {
      notifyApp({ title: 'Workout needs details', message: 'Add a workout name, date, and at least one exercise.', tone: 'warning' })
      return false
    }

    const routine = routines.find(row => row._id === nextWorkout.routineId)
    const totals = getExerciseTotals(exercises)
    const resolvedDuration = getResolvedRoutineDuration(nextWorkout.duration, exercises, savedLakasSettings.workoutDefaults.durationMinutes)

    await fsAdd(user.uid, 'lakasWorkouts', {
      title: String(nextWorkout.title || '').trim(),
      routineId: routine?._id || '',
      routineName: routine?.name || '',
      date: nextWorkout.date,
      duration: resolvedDuration,
      exercises,
      exerciseCount: totals.exerciseCount,
      setCount: totals.setCount,
      volume: totals.volume,
      notes: String(nextWorkout.notes || '').trim(),
      source: 'lakas',
      routeCoordinates: nextWorkout.routeCoordinates || null,
      distance: nextWorkout.distance || null,
      pace: nextWorkout.pace || null,
    })
    setWorkoutForm(createWorkoutForm(savedLakasSettings))
    notifyApp({ title: 'Workout saved', message: 'Your workout is now in Lakas.', tone: 'success' })
    return true
  }

  async function handleSaveGymSession() {
    const actualMinutes = activeGymElapsedSeconds > 0
      ? Math.max(1, Math.round(activeGymElapsedSeconds / 60))
      : numberOrZero(workoutForm.duration)
    const completionNote = `Session completion: ${activeGymCompletedCount}/${activeGymExercises.length} exercises and ${activeGymDoneSetCount}/${activeGymTotalSets} sets completed. Warm-up ${gymSessionMode.warmupDone ? 'completed' : 'not confirmed'}.`
    const saved = await handleAddWorkout({
      duration: String(actualMinutes),
      notes: [workoutForm.notes, completionNote].filter(Boolean).join(' '),
    })
    if (saved) closeGymSessionMode()
  }

  async function handleSaveRunningSession(elapsedSeconds, distance, coordinates) {
    const actualMinutes = elapsedSeconds > 0 ? Math.max(1, Math.round(elapsedSeconds / 60)) : 0
    const paceSeconds = distance > 0 ? Math.round(elapsedSeconds / distance) : 0
    const paceM = Math.floor(paceSeconds / 60)
    const paceS = paceSeconds % 60
    const paceStr = distance > 0 ? `${paceM}:${String(paceS).padStart(2, '0')}` : '−:−−'
    const durationH = Math.floor(elapsedSeconds / 3600)
    const durationM = Math.floor((elapsedSeconds % 3600) / 60)
    const durationS = elapsedSeconds % 60
    const durationStr = durationH > 0 ? `${durationH}:${String(durationM).padStart(2, '0')}:${String(durationS).padStart(2, '0')}` : `${durationM}:${String(durationS).padStart(2, '0')}`

    const runNote = `Outdoor run logged: Ran ${distance.toFixed(2)} km in ${durationStr} (Pace: ${paceStr}/km).`
    const saved = await handleAddWorkout({
      title: 'Outdoor Run',
      duration: String(actualMinutes),
      notes: runNote,
      exercises: [{ name: 'Running', sets: 1, reps: 0, weight: 0, completed: true }],
      routeCoordinates: coordinates || [],
      distance: Number(distance.toFixed(2)),
      pace: paceStr,
    })
    if (saved) closeGymSessionMode()
  }

  async function handleAddMeal() {
    if (!mealForm.name.trim() || !mealForm.date) {
      notifyApp({ title: 'Meal needs details', message: 'Add a meal name and date before saving.', tone: 'warning' })
      return
    }

    setSavingMeal(true)
    try {
      const mealPayload = {
        ...mealForm,
        name: mealForm.name.trim(),
        calories: numberOrZero(mealForm.calories),
        protein: numberOrZero(mealForm.protein),
        carbs: numberOrZero(mealForm.carbs),
        fat: numberOrZero(mealForm.fat),
        notes: mealForm.notes.trim(),
      }
      await fsSaveLakasMeal(user.uid, mealPayload)
      setMealForm(createMealForm())
      notifyApp({ title: 'Meal saved', message: 'Your meal log is saved with the nutrition estimate.', tone: 'success' })
    } catch {
      notifyApp({ title: 'Meal not saved', message: 'Could not save this meal right now. Try again.', tone: 'error' })
    } finally {
      setSavingMeal(false)
    }
  }

  async function handleAddBodyLog() {
    const hasMetric = Object.entries(bodyForm).some(([key, value]) => key !== 'date' && key !== 'notes' && String(value || '').trim())
    if (!bodyForm.date || !hasMetric) {
      notifyApp({ title: 'Body log needs details', message: 'Add at least one body metric before saving.', tone: 'warning' })
      return
    }

    setSavingBody(true)
    try {
      const bodyPayload = {
        ...bodyForm,
        weight: numberOrZero(bodyForm.weight),
        height: numberOrZero(bodyForm.height),
        waist: numberOrZero(bodyForm.waist),
        chest: numberOrZero(bodyForm.chest),
        hips: numberOrZero(bodyForm.hips),
        arm: numberOrZero(bodyForm.arm),
        thigh: numberOrZero(bodyForm.thigh),
        bmi: calculateBmi(bodyForm.weight, bodyForm.height, savedLakasSettings.units.weight, savedLakasSettings.units.body),
        notes: bodyForm.notes.trim(),
      }
      await fsSaveLakasBodyLog(user.uid, bodyPayload)
      setBodyForm(createBodyForm())
      notifyApp({ title: 'Body log saved', message: 'Your body log is now part of the trend view.', tone: 'success' })
    } catch {
      notifyApp({ title: 'Body log not saved', message: 'Could not save this body log right now. Try again.', tone: 'error' })
    } finally {
      setSavingBody(false)
    }
  }

  async function handleAddActivity() {
    if (!activityForm.date || (!activityForm.steps && !activityForm.walkingMinutes && !activityForm.cardioMinutes && !activityForm.activeMinutes)) {
      notifyApp({ title: 'Activity needs details', message: 'Add steps or activity minutes before saving.', tone: 'warning' })
      return
    }

    await fsAdd(user.uid, 'lakasActivities', {
      date: activityForm.date,
      type: activityForm.type,
      steps: numberOrZero(activityForm.steps),
      walkingMinutes: numberOrZero(activityForm.walkingMinutes),
      cardioMinutes: numberOrZero(activityForm.cardioMinutes),
      activeMinutes: numberOrZero(activityForm.activeMinutes),
      distance: numberOrZero(activityForm.distance),
      notes: activityForm.notes.trim(),
      source: 'lakas',
    })
    setActivityForm(createActivityForm())
    notifyApp({ title: 'Activity saved', message: 'Steps and activity have been added.', tone: 'success' })
  }

  async function handleAddHabit() {
    const score = getHabitScore(habitForm)
    if (!habitForm.date || (!score && !habitForm.notes.trim() && !habitForm.waterGlasses)) {
      notifyApp({ title: 'Check-in needs details', message: 'Tick at least one habit, track water, or add a note.', tone: 'warning' })
      return
    }

    const payload = {
      ...HABIT_OPTIONS.reduce((payload, option) => ({ ...payload, [option.key]: Boolean(habitForm[option.key]) }), {}),
      waterGlasses: numberOrZero(habitForm.waterGlasses),
      date: habitForm.date,
      score,
      notes: habitForm.notes.trim(),
      source: 'lakas',
    }

    const existing = habits.find(h => h.date === habitForm.date)
    if (existing) {
      await fsUpdate(user.uid, 'lakasHabits', existing._id, payload)
      notifyApp({ title: 'Check-in updated', message: 'Habit check-in has been updated.', tone: 'success' })
    } else {
      await fsAdd(user.uid, 'lakasHabits', payload)
      notifyApp({ title: 'Check-in saved', message: 'Habit check-in added.', tone: 'success' })
    }
    setHabitForm(createHabitForm())
  }

  const updateWaterGlasses = (glasses) => {
    playTick()
    const nextGlasses = Math.max(0, glasses)
    const waterTarget = Number(savedLakasSettings.targets.water) || 8
    setHabitForm(current => ({
      ...current,
      waterGlasses: nextGlasses,
      water: nextGlasses >= waterTarget
    }))
  }

  const handleHabitChange = (key, checked) => {
    playTick()
    setHabitForm(current => {
      const updates = { [key]: checked }
      if (key === 'water') {
        const waterTarget = Number(savedLakasSettings.targets.water) || 8
        updates.waterGlasses = checked ? waterTarget : 0
      }
      return { ...current, ...updates }
    })
  }

  async function handleQuickAdjustWater(delta) {
    const todayHabit = habits.find(h => h.date === today())
    const currentGlasses = todayHabit ? numberOrZero(todayHabit.waterGlasses) : 0
    const nextGlasses = Math.max(0, currentGlasses + delta)
    const waterTarget = Number(savedLakasSettings.targets.water) || 8
    const isComplete = nextGlasses >= waterTarget

    const payload = todayHabit ? { ...todayHabit } : { date: today(), source: 'lakas' }
    payload.waterGlasses = nextGlasses
    payload.water = isComplete
    payload.score = getHabitScore(payload)

    delete payload._id
    delete payload.createdAt
    delete payload.updatedAt

    try {
      if (todayHabit?._id) {
        await fsUpdate(user.uid, 'lakasHabits', todayHabit._id, payload)
      } else {
        await fsAdd(user.uid, 'lakasHabits', payload)
      }
      notifyApp({ title: 'Water updated', message: `You logged ${nextGlasses} glass${nextGlasses === 1 ? '' : 'es'} of water today.`, tone: 'success' })
    } catch (e) {
      notifyApp({ title: 'Error logging water', message: 'Could not save water log.', tone: 'error' })
    }
  }

  async function handleSaveMealCombo() {
    if (!mealForm.name.trim()) {
      notifyApp({ title: 'Enter a meal name', message: 'You need a name to save a quick combo preset.', tone: 'warning' })
      return
    }
    const newCombo = {
      name: mealForm.name.trim(),
      calories: numberOrZero(mealForm.calories),
      protein: numberOrZero(mealForm.protein),
      carbs: numberOrZero(mealForm.carbs),
      fat: numberOrZero(mealForm.fat),
    }

    const nextCombos = [...(savedLakasSettings.mealCombos || []), newCombo]
    const nextSettings = {
      ...settingsForm,
      mealCombos: nextCombos,
    }

    try {
      await fsSetProfile(user.uid, { lakasSettings: sanitizeLakasSettings(nextSettings) })
      setSettingsForm(nextSettings)
      notifyApp({ title: 'Combo preset saved', message: `Saved "${newCombo.name}" to your quick-tap combos.`, tone: 'success' })
    } catch (e) {
      notifyApp({ title: 'Could not save preset', message: 'Check your connection and try again.', tone: 'error' })
    }
  }

  async function handleDeleteMealCombo(index) {
    const nextCombos = (savedLakasSettings.mealCombos || []).filter((_, idx) => idx !== index)
    const nextSettings = {
      ...settingsForm,
      mealCombos: nextCombos,
    }

    try {
      await fsSetProfile(user.uid, { lakasSettings: sanitizeLakasSettings(nextSettings) })
      setSettingsForm(nextSettings)
      notifyApp({ title: 'Combo preset deleted', message: 'Preset removed.', tone: 'success' })
    } catch (e) {
      notifyApp({ title: 'Could not delete preset', message: 'Check your connection and try again.', tone: 'error' })
    }
  }

  async function handleAddGoal() {
    if (!goalForm.name.trim() || !goalForm.target) {
      notifyApp({ title: 'Goal needs details', message: 'Add a goal name and target.', tone: 'warning' })
      return
    }

    const target = numberOrZero(goalForm.target)
    const current = numberOrZero(goalForm.current)
    if (target <= 0) {
      notifyApp({ title: 'Check goal target', message: 'Goal target must be greater than zero.', tone: 'warning' })
      return
    }

    await fsAdd(user.uid, 'lakasGoals', {
      name: goalForm.name.trim(),
      type: goalForm.type,
      target,
      current,
      unit: goalForm.unit.trim() || 'units',
      source: 'lakas',
    })
    setGoalForm(createGoalForm())
    notifyApp({ title: 'Goal saved', message: 'Your fitness goal is now tracked.', tone: 'success' })
  }

  async function handleAddReminder() {
    if (!reminderForm.title.trim() || !reminderForm.date) {
      notifyApp({ title: 'Reminder needs details', message: 'Add a reminder title and date.', tone: 'warning' })
      return
    }

    await fsAdd(user.uid, 'lakasReminders', {
      title: reminderForm.title.trim(),
      type: reminderForm.type,
      date: reminderForm.date,
      time: reminderForm.time,
      frequency: reminderForm.frequency,
      notes: reminderForm.notes.trim(),
      enabled: true,
      source: 'lakas',
    })
    setReminderForm(createReminderForm(savedLakasSettings))
    notifyApp({ title: 'Reminder saved', message: 'Your Lakas reminder has been added.', tone: 'success' })
  }

  async function handleGoalProgress(goal) {
    const value = numberOrZero(goalProgress[goal._id])
    if (value <= 0) {
      notifyApp({ title: 'Progress needs a value', message: 'Add a number greater than zero.', tone: 'warning' })
      return
    }
    await fsUpdate(user.uid, 'lakasGoals', goal._id, {
      current: Math.min(numberOrZero(goal.target), numberOrZero(goal.current) + value),
      updatedAt: Date.now(),
    })
    setGoalProgress(current => ({ ...current, [goal._id]: '' }))
  }

  function updateSettingGroup(group, field, value) {
    setSettingsForm(current => ({
      ...current,
      [group]: {
        ...(current[group] || {}),
        [field]: value,
      },
    }))
  }

  function applyRecompStarterDefaults() {
    setSettingsForm(current => {
      const defaults = getRecompStarterDefaults(bodyLogs, current)
      return {
        ...current,
        baseline: {
          ...current.baseline,
          goal: 'Recomp',
        },
        meals: {
          ...current.meals,
          calorieGoal: numberOrZero(current.meals?.calorieGoal) || defaults.calorieGoal,
          proteinGoal: defaults.proteinGoal,
          macroStyle: 'Recomp',
        },
        targets: {
          ...current.targets,
          calories: numberOrZero(current.targets?.calories) || defaults.calorieGoal,
          protein: defaults.proteinGoal,
          steps: defaults.steps,
          water: defaults.water,
          sleep: defaults.sleep,
          workoutsPerWeek: defaults.workoutsPerWeek,
        },
      }
    })
    notifyApp({
      title: 'Starter defaults loaded',
      message: 'Recomp targets are ready. Save Lakas settings when you want to keep them.',
      tone: 'success',
    })
  }

  function handleQueueExerciseLibraryEntry() {
    const name = String(exerciseLibraryDraft.name || '').trim()
    if (!name) {
      notifyApp({ title: 'Exercise needs a name', message: 'Add an exercise name before saving it to the library.', tone: 'warning' })
      return
    }

    const entry = sanitizeExerciseLibrary([{
      name,
      category: exerciseLibraryDraft.category,
      primaryMuscle: exerciseLibraryDraft.primaryMuscle,
      secondaryMuscles: exerciseLibraryDraft.secondaryMuscles,
    }])[0]

    if (!entry) return

    setSettingsForm(current => ({
      ...current,
      exerciseLibrary: sanitizeExerciseLibrary([
        ...normalizeRows(current.exerciseLibrary),
        entry,
      ]),
    }))
    setExerciseLibraryDraft(createExerciseLibraryDraft())
    notifyApp({ title: 'Exercise added', message: 'Save Lakas settings when you want to keep this library entry.', tone: 'success' })
  }

  function handleEditExerciseLibraryEntry(entry) {
    setExerciseLibraryDraft({
      name: entry.name || '',
      category: entry.category || 'Strength',
      primaryMuscle: entry.primaryMuscle || 'Full body',
      secondaryMuscles: normalizeExerciseSecondaryMuscles(entry.secondaryMuscles).join(', '),
    })
  }

  function handleRemoveExerciseLibraryEntry(name) {
    const key = normalizeExerciseKey(name)
    setSettingsForm(current => ({
      ...current,
      exerciseLibrary: sanitizeExerciseLibrary(
        normalizeRows(current.exerciseLibrary).filter(entry => normalizeExerciseKey(entry.name) !== key),
      ),
    }))
    notifyApp({ title: 'Exercise removed', message: 'The pending library entry was removed.', tone: 'success' })
  }

  async function handleInlineAddExercise(name) {
    const cleanName = String(name || '').trim()
    if (!cleanName) return

    const key = normalizeExerciseKey(cleanName)
    const exists = savedExerciseLibrary.some(entry => normalizeExerciseKey(entry.name) === key)
    if (exists) return

    const newEntry = {
      name: cleanName,
      category: 'Strength',
      primaryMuscle: 'Full body',
      secondaryMuscles: [],
    }

    const updatedLibrary = sanitizeExerciseLibrary([
      ...normalizeRows(settingsForm.exerciseLibrary),
      newEntry,
    ])

    const nextSettings = sanitizeLakasSettings({
      ...settingsForm,
      exerciseLibrary: updatedLibrary,
    })

    try {
      await fsSetProfile(user.uid, { lakasSettings: nextSettings })
      setSettingsForm(nextSettings)
      notifyApp({ title: 'Added to library', message: `"${cleanName}" has been added to your exercise library.`, tone: 'success' })
    } catch (e) {
      notifyApp({ title: 'Failed to add', message: 'Could not update your exercise library.', tone: 'error' })
    }
  }

  async function handleSaveLakasSettings() {
    setSavingSettings(true)
    try {
      const nextSettings = sanitizeLakasSettings(settingsForm)
      await fsSetProfile(user.uid, { lakasSettings: nextSettings })
      setSettingsForm(nextSettings)
      notifyApp({ title: 'Settings saved', message: 'Your Lakas defaults were updated.', tone: 'success' })
    } catch {
      notifyApp({ title: 'Settings not saved', message: 'Check your connection and try again.', tone: 'error' })
    } finally {
      setSavingSettings(false)
    }
  }

  function handleExportLakasData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        lakasSettings: sanitizeLakasSettings(settingsForm),
      },
      lakasRoutines: routines,
      lakasWorkouts: workouts,
      lakasBodyLogs: bodyLogs,
      lakasActivities: activities,
      lakasHabits: habits,
      lakasReminders: reminders,
      lakasMeals: meals,
      lakasGoals: goals,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `buhay-lakas-backup-${today()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    notifyApp({ title: 'Export ready', message: 'Your Lakas backup has been downloaded.', tone: 'success' })
  }

  async function handleLogout() {
    const [{ signOut }, { auth }] = await Promise.all([
      import('firebase/auth'),
      import('../lib/firebase'),
    ])
    await signOut(auth)
  }

  async function handleDeleteLakasData() {
    const confirmed = await confirmDeleteApp('all Lakas fitness data')
    if (!confirmed) return

    setDeletingLakasData(true)
    try {
      const collections = [
        ['lakasRoutines', routines],
        ['lakasWorkouts', workouts],
        ['lakasActivities', activities],
        ['lakasHabits', habits],
        ['lakasReminders', reminders],
        ['lakasGoals', goals],
      ]
      const docDeletes = collections.flatMap(([collectionName, rows]) => (
        normalizeRows(rows)
          .filter(row => row._id)
          .map(row => fsDel(user.uid, collectionName, row._id))
      ))
      const mediaDeletes = [
        ...bodyLogs.filter(row => row._id).map(row => fsDeleteLakasBodyLog(user.uid, row)),
        ...meals.filter(row => row._id).map(row => fsDeleteLakasMeal(user.uid, row)),
      ]
      await Promise.all([...docDeletes, ...mediaDeletes])
      notifyApp({ title: 'Lakas data cleared', message: 'Fitness logs were deleted. Lakas settings were kept.', tone: 'success' })
    } catch {
      notifyApp({ title: 'Could not clear Lakas', message: 'Some data may still remain. Check your connection and try again.', tone: 'error' })
    } finally {
      setDeletingLakasData(false)
    }
  }

  const latestBmiLabel = getBmiLabel(insights.latestBmi)
  const upcomingReminders = reminders.filter(row => row.enabled !== false).slice(0, 5)
  const latestWorkout = workouts[0] || null
  const featuredRoutine = routines[0] || null
  const leadGoal = goals[0] || null
  const activeGoalCount = goals.length
  const selectedWorkoutDifficulty = selectedGymTemplate?.difficulty || (selectedGymSession.key === 'beginner' ? 'Beginner' : selectedGymTemplate?.focus || 'Guided')
  const selectedTemplateCues = selectedGymExercises
    .map(exercise => ({ exercise: exercise.name, guide: getExerciseGuide(exercise.name) }))
    .filter(item => item.guide)
    .slice(0, 3)
  const selectedTemplateAlternatives = selectedGymExercises
    .map(exercise => {
      const alternative = getExerciseAlternativeHint(exercise.name, savedLakasSettings)
      return alternative ? { exercise: exercise.name, alternative } : null
    })
    .filter(Boolean)
    .slice(0, 3)
  const matchedTemplateHistoryCount = selectedGymExercises.reduce(
    (count, exercise) => count + (exerciseHistory[normalizeExerciseKey(exercise.name)] ? 1 : 0),
    0,
  )
  const progressHighlightExercise = exerciseInsights.mainExercises[0] || null
  const progressHistoryHighlight = exerciseInsights.historyCharts[0] || null
  const leadGoalTarget = numberOrZero(leadGoal?.target)
  const leadGoalCurrent = numberOrZero(leadGoal?.current)
  const leadGoalPct = leadGoalTarget > 0 ? Math.min(100, Math.round((leadGoalCurrent / leadGoalTarget) * 100)) : 0
  const safeTrackView = normalizeTrackView(trackView, activeTab)
  const legacyTabAliases = {
    today: 'workout',
    overview: 'workout',
    train: 'workout',
    workouts: 'workout',
    log: 'workout',
    track: 'body',
    nutrition: 'body',
    meals: 'body',
    body: 'body',
    measurements: 'body',
    'body-log': 'body',
    activity: 'body',
    habits: 'body',
    goals: 'body',
    reminders: 'settings',
  }
  const normalizedRequestedTab = legacyTabAliases[activeTab] || activeTab
  const currentTab = LAKAS_TAB_COPY[normalizedRequestedTab] ? normalizedRequestedTab : 'workout'
  const showWorkouts = currentTab === 'workout'
  const showWorkoutLog = currentTab === 'workout'
  const showBody = currentTab === 'body' && safeTrackView === 'body'
  const showMeals = currentTab === 'body' && safeTrackView === 'meals'
  const showMovement = currentTab === 'body' && safeTrackView === 'activity'
  const showRecovery = currentTab === 'body' && safeTrackView === 'recovery'
  const showGoals = currentTab === 'body' && safeTrackView === 'goals'
  const showProgress = currentTab === 'progress'
  const showSettings = currentTab === 'settings'
  const tabCopy = LAKAS_TAB_COPY[currentTab] || LAKAS_TAB_COPY.workout
  const workoutVolume7d = insights.volumeByDay.reduce((sum, row) => sum + numberOrZero(row.value), 0)

  // Today at-a-glance strip data
  const todayWorkoutDone = workouts.some(row => row.date === today())
  const todayWaterTarget = Math.max(1, numberOrZero(savedLakasSettings.targets.water) || 8)
  const todayWaterPct = Math.min(100, Math.round((insights.waterGlassesToday / todayWaterTarget) * 100))
  const todayCaloriePct = coachingSystem.nutrition.calorieTarget > 0
    ? Math.min(100, Math.round((insights.caloriesToday / coachingSystem.nutrition.calorieTarget) * 100))
    : 0
  const todayProteinPct = coachingSystem.nutrition.proteinTarget > 0
    ? Math.min(100, Math.round((insights.proteinToday / coachingSystem.nutrition.proteinTarget) * 100))
    : 0
  const todayStepTarget = Math.max(1, numberOrZero(savedLakasSettings.targets.steps) || 8000)
  const todayStepPct = Math.min(100, Math.round((insights.stepsToday / todayStepTarget) * 100))
  const todayHabitPct = HABIT_OPTIONS.length > 0 ? Math.min(100, Math.round((insights.habitScoreToday / HABIT_OPTIONS.length) * 100)) : 0
  const mealsToday = meals.filter(row => row.date === today()).length
  const latestBodyLog = bodyLogs[0] || {}
  const completedGoals = resolvedGoals.filter(goal => {
    const target = numberOrZero(goal.target)
    return target > 0 && numberOrZero(goal.current) >= target
  }).length
  const activeGoalsCount = resolvedGoals.filter(goal => {
    const target = numberOrZero(goal.target)
    return target > 0 && numberOrZero(goal.current) < target
  }).length
  const enabledReminders = reminders.filter(row => row.enabled !== false).length
  const pausedReminders = reminders.filter(row => row.enabled === false).length
  const todayReminders = reminders.filter(row => row.enabled !== false && row.date === today()).length
  const habitCheckins7d = habits.filter(row => row.date >= dateDaysAgo(6)).length
  const shouldShowBmi = savedLakasSettings.display.showBmi !== false
  const hideBodyPhotos = privacyMode && savedLakasSettings.display.hideProgressPhotosInPrivacy !== false
  let latestBodyMeta = 'Add height and weight to calculate BMI'
  if (!shouldShowBmi) {
    latestBodyMeta = 'BMI hidden'
  } else if (latestBodyLog.date || insights.latestBmi) {
    latestBodyMeta = privacyMode
      ? 'Private measurements'
      : insights.latestBmi
        ? `BMI ${formatNumber(insights.latestBmi, 1)} · ${latestBmiLabel}`
        : latestBmiLabel
  }
  const bodyHeroCard = {
    meals: {
      label: 'Meal tracking',
      value: displayMetric(mealsToday, 'meals today', privacyMode, 0),
      meta: `${displayMetric(insights.caloriesToday, 'kcal', privacyMode, 0)} · ${displayMetric(insights.proteinToday, 'g protein', privacyMode, 0)}`,
    },
    body: {
      label: 'Body tracking',
      value: insights.latestWeight ? displayMetric(insights.latestWeight, savedLakasSettings.units.weight, privacyMode) : 'No body log',
      meta: latestBodyLog.date ? `${formatDisplayDate(latestBodyLog.date)} · ${latestBodyMeta}` : latestBodyMeta,
    },
    activity: {
      label: 'Movement',
      value: displayMetric(insights.stepsToday, 'steps today', privacyMode, 0),
      meta: `${displayMetric(numberOrZero(activities[0]?.activeMinutes || 0), 'active min', privacyMode, 0)} latest · ${displayMetric(numberOrZero(activities[0]?.distance || 0), savedLakasSettings.units.distance, privacyMode, 1)}`,
    },
    recovery: {
      label: 'Recovery',
      value: privacyMode ? `.../${HABIT_OPTIONS.length}` : `${insights.habitScoreToday}/${HABIT_OPTIONS.length}`,
      meta: `${displayMetric(habitCheckins7d, 'check-ins', privacyMode, 0)} this week · ${habits[0]?.date ? formatDisplayDate(habits[0].date) : 'No check-in yet'}`,
    },
    goals: {
      label: 'Goals',
      value: displayMetric(activeGoalsCount, 'active goals', privacyMode, 0),
      meta: `${displayMetric(completedGoals, 'completed', privacyMode, 0)} done · ${displayMetric(enabledReminders, 'reminders on', privacyMode, 0)}`,
    },
  }[safeTrackView] || {
    label: 'Meal tracking',
    value: displayMetric(mealsToday, 'meals today', privacyMode, 0),
    meta: `${displayMetric(insights.caloriesToday, 'kcal', privacyMode, 0)} · ${displayMetric(insights.proteinToday, 'g protein', privacyMode, 0)}`,
  }
  const showTrackSwitcher = currentTab === 'body'
  const currentBodyTrackView = LAKAS_TRACK_VIEWS.find(view => view.id === safeTrackView) || LAKAS_TRACK_VIEWS[0]
  const bodyQuickStartSummary = safeTrackView === 'goals'
    ? activeGoalCount
      ? `${activeGoalCount} active goals stay here with progress updates and reminder support.`
      : 'Save a longer target here when you want progress beyond the daily logs.'
    : currentBodyTrackView.meta
  const bodyOverviewCards = [
    {
      label: 'Current focus',
      value: currentBodyTrackView.label,
      meta: bodyQuickStartSummary,
    },
    {
      label: 'Nutrition today',
      value: `${displayMetric(insights.caloriesToday, 'kcal', privacyMode, 0)} · ${displayMetric(insights.proteinToday, 'g protein', privacyMode, 0)}`,
      meta: `${displayMetric(mealsToday, 'meals', privacyMode, 0)} logged · ${coachingSystem.profile.nutritionMode}`,
    },
    {
      label: 'Recovery today',
      value: privacyMode ? `.../${HABIT_OPTIONS.length}` : `${insights.habitScoreToday}/${HABIT_OPTIONS.length}`,
      meta: `${coachingSystem.profile.recovery.label} · ${displayMetric(insights.stepsToday, 'steps', privacyMode, 0)}`,
    },
  ]
  const progressSnapshotCards = [
    {
      label: 'This week',
      value: displayMetric(insights.workoutsThisWeek, 'workouts', privacyMode, 0),
      meta: `Target ${displayMetric(weeklyWorkoutTarget, 'workouts', privacyMode, 0)}`,
    },
    {
      label: 'Streak',
      value: displayMetric(insights.records.workoutStreak, 'days', privacyMode, 0),
      meta: 'Current consistency',
    },
    {
      label: 'Main lifts',
      value: displayMetric(exerciseInsights.mainExercises.length, '', privacyMode, 0),
      meta: progressHighlightExercise ? progressHighlightExercise.name : 'Waiting for more history',
    },
    {
      label: 'Weight trend',
      value: coachingSystem.progress.weightTrend.direction === 'unknown'
        ? 'No trend yet'
        : coachingSystem.progress.weightTrend.direction === 'steady'
          ? 'Steady'
          : coachingSystem.progress.weightTrend.direction === 'up'
            ? 'Trending up'
            : 'Trending down',
      meta: coachingSystem.progress.weightTrend.label,
    },
  ]
  useEffect(() => {
    mealPhotoUrlsRef.current = mealPhotoUrls
  }, [mealPhotoUrls])

  useEffect(() => {
    bodyPhotoUrlsRef.current = bodyPhotoUrls
  }, [bodyPhotoUrls])

  useEffect(() => {
    return () => {
      Object.values(mealPhotoUrlsRef.current).forEach(revokeObjectUrl)
      Object.values(bodyPhotoUrlsRef.current).forEach(revokeObjectUrl)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const visibleIds = new Set(visibleMeals.map(meal => meal._id))

    setMealPhotoUrls(current => {
      let changed = false
      const next = {}
      Object.entries(current).forEach(([id, value]) => {
        if (visibleIds.has(id)) {
          next[id] = value
        } else {
          changed = true
          revokeObjectUrl(value)
        }
      })
      return changed ? next : current
    })

    visibleMeals.forEach(meal => {
      if (!meal.photoPath || mealPhotoUrlsRef.current[meal._id]) return

      loadStorageObjectUrl(meal.photoPath)
        .then(url => {
          if (cancelled) {
            revokeObjectUrl(url)
            return
          }

          setMealPhotoUrls(current => {
            if (current[meal._id]) {
              revokeObjectUrl(url)
              return current
            }
            return { ...current, [meal._id]: url }
          })
        })
        .catch(() => {})
    })

    return () => {
      cancelled = true
    }
  }, [visibleMeals])

  useEffect(() => {
    let cancelled = false
    const visibleIds = new Set(visibleBodyLogs.map(log => log._id))

    setBodyPhotoUrls(current => {
      let changed = false
      const next = {}
      Object.entries(current).forEach(([id, value]) => {
        if (visibleIds.has(id)) {
          next[id] = value
        } else {
          changed = true
          revokeObjectUrl(value)
        }
      })
      return changed ? next : current
    })

    visibleBodyLogs.forEach(log => {
      if (!log.photoPath || bodyPhotoUrlsRef.current[log._id]) return

      loadStorageObjectUrl(log.photoPath)
        .then(url => {
          if (cancelled) {
            revokeObjectUrl(url)
            return
          }

          setBodyPhotoUrls(current => {
            if (current[log._id]) {
              revokeObjectUrl(url)
              return current
            }
            return { ...current, [log._id]: url }
          })
        })
        .catch(() => {})
    })

    return () => {
      cancelled = true
    }
  }, [visibleBodyLogs])

  useEffect(() => {
    if (!actionRequest?.token || handledActionTokenRef.current === actionRequest.token) return undefined

    if (actionRequest.type === 'gym-session') {
      if (currentTab !== 'workout') return undefined
      handledActionTokenRef.current = actionRequest.token
      const frameId = window.requestAnimationFrame(() => {
        openGymSessionMode(selectedGymTemplate, selectedGymSession)
        onActionHandled(actionRequest.token)
      })
      return () => window.cancelAnimationFrame(frameId)
    }

    if (actionRequest.type === 'run-session') {
      if (currentTab !== 'workout') return undefined
      handledActionTokenRef.current = actionRequest.token
      const runSession = GYM_SESSION_TYPES.find(s => s.key === 'running')
      const runTemplate = { name: 'Outdoor Run', exercises: [{ name: 'Running', sets: 1, reps: 0, weight: 0 }] }
      const frameId = window.requestAnimationFrame(() => {
        openGymSessionMode(runTemplate, runSession)
        onActionHandled(actionRequest.token)
      })
      return () => window.cancelAnimationFrame(frameId)
    }

    if (actionRequest.type === 'meal-log') {
      if (currentTab !== 'body') return undefined
      handledActionTokenRef.current = actionRequest.token
      setTrackView('meals')
      setPendingQuickAction({ type: 'meal-log', token: actionRequest.token })
      return undefined
    }

    handledActionTokenRef.current = actionRequest.token
    onActionHandled(actionRequest.token)
    return undefined
  }, [actionRequest, currentTab, onActionHandled, selectedGymSession, selectedGymTemplate])

  useEffect(() => {
    if (!pendingQuickAction || pendingQuickAction.type !== 'meal-log' || !showMeals) return undefined
    const frameId = window.requestAnimationFrame(() => {
      safeScrollIntoView(mealQuickActionRef.current, { behavior: 'smooth', block: 'start' })
      mealNameInputRef.current?.focus()
      onActionHandled(pendingQuickAction.token)
      setPendingQuickAction(null)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [pendingQuickAction, showMeals, onActionHandled])

  const gymSessionOverlay = gymSessionMode.open ? (
    <div className={lStyles.gymModeOverlay} role="dialog" aria-modal="true" aria-labelledby="gym-session-title">
      <div className={lStyles.gymModeBackdrop} onClick={closeGymSessionMode} aria-hidden="true" />
      <section className={`${lStyles.gymModeSheet} ${gymSessionMode.focusMode ? lStyles.gymModeSheetFocus : ''}`}>
        <div className={lStyles.gymModeHeader}>
          <div>
            <div className={lStyles.gymModeEyebrow}>Gym session mode</div>
            <h3 id="gym-session-title">{activeGymTemplate.name}</h3>
            <p>{activeGymSession.label} · {activeGymCompletedCount}/{activeGymExercises.length} exercises done · {activeGymPlanMinutes} min routine</p>
          </div>
          <div className={lStyles.gymModeHeaderActions}>
            <button
              type="button"
              className={`${lStyles.focusModeBtn} ${gymSessionMode.focusMode ? lStyles.focusModeBtnActive : ''}`}
              onClick={() => setGymSessionMode(current => ({ ...current, focusMode: !current.focusMode }))}
            >
              {gymSessionMode.focusMode ? 'Standard View' : 'Focus View'}
            </button>
            <button type="button" className={lStyles.gymModeClose} onClick={closeGymSessionMode} aria-label="Close gym session mode">Close</button>
          </div>
        </div>

        <div className={lStyles.gymModeBody}>
          <div className={lStyles.gymModeCurrentCard}>
            <div className={lStyles.gymModeCurrentTop}>
              <span>Exercise {activeGymExerciseIndex + 1}</span>
              <strong>{activeGymExercise.name}</strong>
            </div>
            <div className={lStyles.gymModeStatGrid}>
              <div><span>Sets</span><strong>{activeGymExercise.sets || 1}</strong></div>
              <div><span>Reps</span><strong>{activeGymExercise.reps || '-'}</strong></div>
              <div><span>Work</span><strong>{estimateExerciseMinutes(activeGymExercise)} min</strong></div>
              <div><span>Rest</span><strong>{activeGymExercise.rest || 0}s</strong></div>
            </div>
            {activeGymExercise.name && (
              <p className={lStyles.gymModeNotes}>
                Suggested start: {getExerciseLoadHint(activeGymExercise.name, savedLakasSettings)}
              </p>
            )}
            {activeGymExercise.name && (
              <div className={lStyles.gymModeToolsRow}>
                <details className={lStyles.gymModeToolDetails}>
                  <summary className={lStyles.gymModeToolSummary}>Plate Calculator</summary>
                  <div className={lStyles.gymModeToolContent}>
                    <label>
                      <span>Target Weight ({savedLakasSettings.units.weight || 'kg'})</span>
                      <input
                        type="number"
                        min="0"
                        value={plateTargetInput}
                        onChange={event => setPlateTargetInput(event.target.value)}
                        placeholder="e.g. 60"
                      />
                    </label>
                    <div>
                      <span>Plates per side:</span>
                      {(() => {
                        const target = numberOrZero(plateTargetInput)
                        const unit = savedLakasSettings.units.weight || 'kg'
                        const calculated = calculatePlates(target, unit)
                        if (!calculated.length) return <p style={{ margin: '4px 0 0', color: 'var(--text3)' }}>No plates needed (under bar weight).</p>
                        return (
                          <div>
                            <strong style={{ display: 'block', margin: '4px 0' }}>
                              {calculated.join(' + ')} {unit}
                            </strong>
                            <div className={lStyles.plateVisual}>
                              <div className={lStyles.plateCalcVisual}>
                                <div className={lStyles.plateCalcBar} />
                                <div className={lStyles.plateCalcSleeve}>
                                  {calculated.map((plate, pIdx) => {
                                    const style = getPlateStyle(plate, unit === 'lbs')
                                    return (
                                      <div
                                        key={`plate-${pIdx}`}
                                        className={lStyles.plateVisualObj}
                                        style={{
                                          background: style.background,
                                          color: style.color,
                                          width: style.width,
                                          height: style.height,
                                        }}
                                      >
                                        {plate}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </details>

                <details className={lStyles.gymModeToolDetails}>
                  <summary className={lStyles.gymModeToolSummary}>Alternative Swaps</summary>
                  <div className={lStyles.gymModeToolContent}>
                    <p style={{ margin: 0 }}>If setup or equipment is busy, try:</p>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px', color: 'var(--text2)' }}>
                      {getExerciseSwapsList(activeGymExercise.name).map((swap, sIdx) => (
                        <li key={`swap-${sIdx}`} style={{ margin: '2px 0' }}>{swap}</li>
                      ))}
                    </ul>
                    {getExerciseAlternativeHint(activeGymExercise.name, savedLakasSettings) && (
                      <small style={{ display: 'block', marginTop: '6px', color: 'var(--accent)' }}>
                        Tip: {getExerciseAlternativeHint(activeGymExercise.name, savedLakasSettings)}
                      </small>
                    )}
                  </div>
                </details>
              </div>
            )}
            {activeGymRestRemaining > 0 && (
              <div className={lStyles.gymModeRestCard} role="timer" aria-live="polite">
                <div className={lStyles.gymModeRestCircleContainer}>
                  <svg className={lStyles.gymModeRestCircleSvg} viewBox="0 0 100 100">
                    <circle
                      className={lStyles.gymModeRestCircleBg}
                      cx="50"
                      cy="50"
                      r="44"
                    />
                    <circle
                      className={lStyles.gymModeRestCircleProgress}
                      cx="50"
                      cy="50"
                      r="44"
                      style={{
                        strokeDashoffset: 276.46 - (276.46 * (activeGymRestRemaining / Math.max(1, gymSessionMode.restDuration || activeGymRestRemaining))),
                      }}
                    />
                  </svg>
                  <div className={lStyles.gymModeRestTimeDisplay}>
                    <span>Resting</span>
                    <strong>{formatDurationClock(activeGymRestRemaining)}</strong>
                  </div>
                </div>
                <Button type="button" variant="ghost" onClick={skipGymRest}>Skip rest</Button>
              </div>
            )}
            <div className={lStyles.gymModeSetTracker} aria-label={`${activeGymExercise.name} set tracker`}>
              {Array.from({ length: activeGymSetCount }, (_, index) => {
                const setNumber = index + 1
                const done = Boolean(activeGymCompletedSets[setNumber])
                return (
                  <button
                    key={`${activeGymExercise.name}-set-${setNumber}`}
                    type="button"
                    className={`${lStyles.gymModeSetButton} ${done ? lStyles.gymModeSetButtonDone : ''}`}
                    onClick={() => toggleGymSet(setNumber)}
                    aria-pressed={done}
                  >
                    Set {setNumber}
                  </button>
                )
              })}
            </div>
            <p className={lStyles.gymModeSetHint}>
              Tap each set as you finish it. Lakas starts the rest timer automatically until the exercise is complete.
            </p>
            {activeWorkoutExercise && activeWorkoutExercise.rowId && (
              <div className={lStyles.gymModeActiveLogger}>
                <div className={lStyles.gymModeLoggerHeader}>
                  <strong>Adjust today's metrics</strong>
                  {activeGymHistory && (
                    <button
                      type="button"
                      className={lStyles.gymModeCopyLastBtn}
                      onClick={() => {
                        updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'sets', String(activeGymHistory.sets || ''));
                        updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'reps', String(activeGymHistory.reps || ''));
                        updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'weight', String(activeGymHistory.weight || ''));
                        updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'rest', String(activeGymHistory.rest || ''));
                        updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'notes', activeGymHistory.notes || '');
                        notifyApp({ title: 'Values copied', message: 'Last session metrics applied.', tone: 'success' });
                      }}
                    >
                      ⚡ Use Last Session ({(activeGymHistory.weight || 0) + (savedLakasSettings.units.weight || 'kg')})
                    </button>
                  )}
                </div>
                <div className={lStyles.gymModeLoggerGrid}>
                  <label>
                    <span>Sets</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={activeWorkoutExercise.sets || ''}
                      placeholder={activeGymHistory ? String(activeGymHistory.sets) : '3'}
                      onChange={event => updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'sets', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Reps</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={activeWorkoutExercise.reps || ''}
                      placeholder={activeGymHistory ? String(activeGymHistory.reps) : '10'}
                      onChange={event => updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'reps', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Weight ({savedLakasSettings.units.weight})</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={activeWorkoutExercise.weight || ''}
                        placeholder={activeGymHistory ? String(activeGymHistory.weight) : '60'}
                        onChange={event => updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'weight', event.target.value)}
                      />
                      {activeGymHasNewPR && (
                        <span className={lStyles.prBadgeInline} title="Personal Record!">
                          🏅 PR!
                        </span>
                      )}
                    </div>
                  </label>
                </div>
                <div className={lStyles.gymModeLoggerNotes}>
                  <label>
                    <span>Set/Exercise Notes</span>
                    <input
                      value={activeWorkoutExercise.notes || ''}
                      placeholder="E.g. Warmup, RPE 8, easy"
                      onChange={event => updateExerciseRow(setWorkoutForm, activeWorkoutExercise.rowId, 'notes', event.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}
            {activeGymGuide && (
              <div className={lStyles.gymModeCue}>
                <strong>{activeGymGuide.name} cue</strong>
                <span>{activeGymGuide.setup}</span>
                <small>{activeGymGuide.safety}</small>
              </div>
            )}
            {activeGymExercise.notes && <p className={lStyles.gymModeNotes}>{activeGymExercise.notes}</p>}
            <div className={lStyles.gymModeNextCard}>
              <span>Up next</span>
              {nextGymExercise ? (
                <>
                  <strong>{nextGymExercise.name}</strong>
                  <small>{nextGymExercise.sets || 1} sets · {nextGymExercise.reps ? `${nextGymExercise.reps} reps` : `${Math.round(numberOrZero(nextGymExercise.duration) / 60)} min`} · {nextGymExercise.rest || 0}s rest</small>
                </>
              ) : (
                <>
                  <strong>Finish and save</strong>
                  <small>Complete this last exercise, review the summary, then save the workout log.</small>
                </>
              )}
            </div>
            <div className={lStyles.gymModeControls}>
              <Button type="button" variant="ghost" onClick={() => setGymModeExercise(activeGymExerciseIndex - 1)} disabled={activeGymExerciseIndex === 0}>Previous</Button>
              <Button type="button" variant="secondary" onClick={completeCurrentGymExercise}>
                {gymSessionMode.completed?.[activeGymExerciseIndex]
                  ? 'Undo done'
                  : activeGymExerciseIndex >= activeGymExercises.length - 1
                    ? 'Complete exercise'
                    : 'Complete + next'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setGymModeExercise(activeGymExerciseIndex + 1)} disabled={activeGymExerciseIndex >= activeGymExercises.length - 1}>Next</Button>
            </div>
            {activeGymFinished && (
              <div className={lStyles.gymModeSummaryCard}>
                <strong>Session ready to save</strong>
                <span>{activeGymCompletedCount}/{activeGymExercises.length} exercises and {activeGymDoneSetCount}/{activeGymTotalSets} sets completed in {formatDurationClock(activeGymElapsedSeconds)}. Warm-up {gymSessionMode.warmupDone ? 'confirmed' : 'not confirmed'}.</span>
              </div>
            )}
            <div className={lStyles.gymModeSaveBar}>
              <div>
                <span>{activeGymFinished ? 'Ready to finish' : `${activeGymDoneSetCount}/${activeGymTotalSets} sets done`}</span>
                <small>{formatDurationClock(activeGymElapsedSeconds)} elapsed</small>
              </div>
              <Button type="button" variant="primary" fullWidth onClick={handleSaveGymSession}>
                {activeGymFinished ? 'Finish and save' : 'Save progress'}
              </Button>
            </div>
          </div>

          {/* Default-open so form videos are immediately discoverable (no friction). */}
          <details
            className={lStyles.gymModeSupport}
            open={gymModeSupportOpen}
            onToggle={event => setGymModeSupportOpen(event.currentTarget.open)}
          >
            <summary className={lStyles.gymModeSupportSummary}>
              <span>Form video, warm-up, and progress</span>
              <small>{gymSessionMode.warmupDone ? 'Warm-up checked' : 'Warm-up not checked'} · {activeGymProgress}% complete</small>
            </summary>

            {activeGymVideo ? (
              <div className={lStyles.gymModeVideoCard}>
                <iframe
                  key={`${activeGymVideo.id}-${activeGymExerciseIndex}-${gymSessionMode.startedAt || 'session'}-${gymVideoSoundRequested ? 'sound' : 'muted'}`}
                  title={`${activeGymExercise.name || 'Exercise'} form video`}
                  src={getYouTubeEmbedUrl(activeGymVideo.id, { autoplay: true, muted: !gymVideoSoundRequested })}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="eager"
                />
                <div className={lStyles.gymModeVideoMeta}>
                  <span>{activeGymVideo.title}</span>
                  <small>
                    {gymVideoSoundRequested
                      ? 'Sound requested. If Safari still blocks audio, use the YouTube link.'
                      : 'Starts automatically muted. Tap once for sound when you want spoken cues.'}
                  </small>
                  <div className={lStyles.gymModeVideoActions}>
                    <button
                      type="button"
                      className={lStyles.gymModeVideoButton}
                      onClick={() => setGymVideoSoundRequested(current => !current)}
                    >
                      {gymVideoSoundRequested ? 'Restart muted' : 'Play with sound'}
                    </button>
                    <a href={`https://www.youtube.com/watch?v=${activeGymVideo.id}`} target="_blank" rel="noreferrer">Open on YouTube</a>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${lStyles.gymModeVideoCard} ${lStyles.gymModeVideoEmpty}`}>
                <div>
                  <span>No curated form video yet</span>
                  <strong>{activeGymExercise.name || 'Exercise'}</strong>
                  <p>Use the written cues for now. Lakas only embeds vetted form references here.</p>
                </div>
              </div>
            )}

            <div className={lStyles.gymModeProgress}>
              <div>
                <span>Elapsed</span>
                <strong>{formatDurationClock(activeGymElapsedSeconds)}</strong>
              </div>
              <div>
                <span>Routine duration</span>
                <strong>{activeGymPlanMinutes} min</strong>
              </div>
              <div>
                <span>Progress</span>
                <strong>{activeGymProgress}%</strong>
              </div>
              <div className={lStyles.gymModeProgressTrack} aria-hidden="true">
                <i style={{ width: `${activeGymProgress}%` }} />
              </div>
            </div>

            <div className={`${lStyles.gymModePrepCard} ${gymSessionMode.warmupDone ? lStyles.gymModePrepCardDone : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ flex: '1', minWidth: '240px' }}>
                  <span>Warm-up first</span>
                  <strong>{gymSessionMode.warmupDone ? 'Warm-up checked' : '2-4 minutes before the first work set'}</strong>
                  <small>Easy walk or bike, joint circles, then light practice sets for the first exercise to prepare muscles and joints.</small>
                </div>
                <button
                  type="button"
                  className={gymSessionMode.warmupDone ? lStyles.ghostBtn : lStyles.secondaryBtn}
                  onClick={gymSessionMode.warmupDone ? resetGymWarmup : markGymWarmupDone}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {gymSessionMode.warmupDone ? 'Reset warm-up' : 'Warm-up done'}
                </button>
              </div>

              <div style={{ background: 'color-mix(in srgb, var(--surface3) 40%, transparent)', padding: '10px', borderRadius: '12px', border: '1px solid var(--glass-border)', width: '100%' }}>
                <span style={{ fontSize: '9px', fontWeight: '900', color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Generated Warm-Up Protocol (First Exercise: {activeGymExercises[0]?.name || 'Workout'})
                </span>
                {(() => {
                  const unit = savedLakasSettings.units.weight || 'kg'
                  const isLbs = unit === 'lbs'
                  const barWeight = isLbs ? 45 : 20
                  const target = numberOrZero(activeGymExercises[0]?.weight)
                  
                  if (target <= barWeight) {
                    return (
                      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text2)', lineHeight: '1.5' }}>
                        <li>Joint circles (shoulders, hips) &mdash; 10 reps each</li>
                        <li>Bodyweight squats &mdash; 10 reps</li>
                        <li>Glute bridges &mdash; 10 reps</li>
                        <li>Easy practice set of {activeGymExercises[0]?.name || 'exercise'} &mdash; 10 reps (bodyweight)</li>
                      </ul>
                    )
                  }

                  const step1 = barWeight
                  const step2 = Math.round((target * 0.5) / 2.5) * 2.5
                  const step3 = Math.round((target * 0.7) / 2.5) * 2.5
                  const step4 = Math.round((target * 0.9) / 2.5) * 2.5

                  return (
                    <table className={lStyles.warmupTable}>
                      <thead>
                        <tr>
                          <th>Set</th>
                          <th>Intensity</th>
                          <th>Load ({unit})</th>
                          <th>Reps</th>
                          <th>Plates per side</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>1</td>
                          <td>Empty Bar</td>
                          <td>{step1}</td>
                          <td>8</td>
                          <td>Empty bar</td>
                        </tr>
                        {target > barWeight * 1.5 && (
                          <tr>
                            <td>2</td>
                            <td>50% Target</td>
                            <td>{step2}</td>
                            <td>5</td>
                            <td>{calculatePlates(step2, unit).join(' + ') || 'None'}</td>
                          </tr>
                        )}
                        <tr>
                          <td>{target > barWeight * 1.5 ? 3 : 2}</td>
                          <td>70% Target</td>
                          <td>{step3}</td>
                          <td>3</td>
                          <td>{calculatePlates(step3, unit).join(' + ') || 'None'}</td>
                        </tr>
                        <tr>
                          <td>{target > barWeight * 1.5 ? 4 : 3}</td>
                          <td>90% Target</td>
                          <td>{step4}</td>
                          <td>1</td>
                          <td>{calculatePlates(step4, unit).join(' + ') || 'None'}</td>
                        </tr>
                      </tbody>
                    </table>
                  )
                })()}
              </div>
            </div>
          </details>
        </div>

        <div className={lStyles.gymModeExerciseStrip} aria-label="Gym session exercise list">
          {activeGymExercises.map((exercise, index) => (
            <button
              key={`${activeGymTemplate.name}-${exercise.name}-${index}`}
              type="button"
              className={`${lStyles.gymModeExerciseChip} ${index === activeGymExerciseIndex ? lStyles.gymModeExerciseChipActive : ''} ${gymSessionMode.completed?.[index] ? lStyles.gymModeExerciseChipDone : ''}`}
              onClick={() => setGymModeExercise(index)}
              aria-pressed={index === activeGymExerciseIndex}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{exercise.name}</strong>
              <small>{estimateExerciseMinutes(exercise)} min</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  ) : null

  return (
    <div className={`${styles.page} ${lStyles.page}`}>
      {celebrationGoal && (
        <div className={lStyles.celebrationOverlay} onClick={() => setCelebrationGoal(null)}>
          <div className={lStyles.celebrationContent}>
            <div className={lStyles.confettiWrapper}>
              {Array.from({ length: 16 }).map((_, i) => (
                <div 
                  key={i} 
                  className={lStyles.confettiParticle} 
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 0.8}s`,
                    backgroundColor: ['#ffeb3b', '#ff5722', '#4caf50', '#00bcd4', '#e91e63'][i % 5]
                  }} 
                />
              ))}
            </div>
            <div className={lStyles.celebrationEmoji}>🏆</div>
            <h2>Goal Achieved!</h2>
            <p>You hit your target for:</p>
            <strong>{celebrationGoal.name}</strong>
            <span>
              {celebrationGoal.current} / {celebrationGoal.target} {celebrationGoal.unit || ''}
            </span>
            <small>Tap anywhere to close</small>
          </div>
        </div>
      )}
      <datalist id="lakas-exercise-library">
        {exerciseSuggestions.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* Today at-a-glance strip — always visible on every tab */}
      <div className={lStyles.todayStrip} aria-label="Today's summary">
        <div 
          className={`${lStyles.todayStripItem} ${lStyles.todayStripItemInteractive}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            playTick()
            onLakasTabChange('workout')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              playTick()
              onLakasTabChange('workout')
            }
          }}
          aria-label="Workout status: Go to Workouts tab"
        >
          <span className={`${lStyles.todayStripDot} ${todayWorkoutDone ? lStyles.todayStripDotGreen : lStyles.todayStripDotDim}`} />
          <div className={lStyles.todayStripLabel}>
            <strong>{todayWorkoutDone ? 'Workout ✓' : 'Workout'}</strong>
            <span>{todayWorkoutDone ? 'Logged today' : `${displayMetric(insights.workoutsThisWeek, '', privacyMode, 0)}/${weeklyWorkoutTarget} this week`}</span>
          </div>
        </div>

        <div className={lStyles.todayStripDivider} aria-hidden="true" />

        <div 
          className={`${lStyles.todayStripItem} ${lStyles.todayStripItemInteractive}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            playTick()
            onLakasTabChange('body')
            setTrackView('meals')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              playTick()
              onLakasTabChange('body')
              setTrackView('meals')
            }
          }}
          aria-label="Calories: Go to meals log"
        >
          <div className={lStyles.todayStripRing}>
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
              <circle cx="16" cy="16" r="13" fill="none" stroke="var(--surface3)" strokeWidth="3.5" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(25 90% 55%)" strokeWidth="3.5"
                strokeDasharray={`${(todayCaloriePct / 100) * 81.68} 81.68`}
                strokeLinecap="round" strokeDashoffset="20.42"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <span>{privacyMode ? '—' : `${todayCaloriePct}%`}</span>
          </div>
          <div className={lStyles.todayStripLabel}>
            <strong>Calories</strong>
            <span>{privacyMode ? '—' : `${displayMetric(insights.caloriesToday, '', privacyMode, 0)} / ${displayMetric(coachingSystem.nutrition.calorieTarget, 'kcal', privacyMode, 0)}`}</span>
          </div>
        </div>

        <div 
          className={`${lStyles.todayStripItem} ${lStyles.todayStripItemInteractive}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            playTick()
            onLakasTabChange('body')
            setTrackView('meals')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              playTick()
              onLakasTabChange('body')
              setTrackView('meals')
            }
          }}
          aria-label="Protein: Go to meals log"
        >
          <div className={lStyles.todayStripRing}>
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
              <circle cx="16" cy="16" r="13" fill="none" stroke="var(--surface3)" strokeWidth="3.5" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(155 70% 45%)" strokeWidth="3.5"
                strokeDasharray={`${(todayProteinPct / 100) * 81.68} 81.68`}
                strokeLinecap="round" strokeDashoffset="20.42"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <span>{privacyMode ? '—' : `${todayProteinPct}%`}</span>
          </div>
          <div className={lStyles.todayStripLabel}>
            <strong>Protein</strong>
            <span>{privacyMode ? '—' : `${displayMetric(insights.proteinToday, '', privacyMode, 0)}g / ${displayMetric(coachingSystem.nutrition.proteinTarget, 'g', privacyMode, 0)}`}</span>
          </div>
        </div>

        <div 
          className={`${lStyles.todayStripItem} ${lStyles.todayStripItemInteractive}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            playTick()
            onLakasTabChange('body')
            setTrackView('recovery')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              playTick()
              onLakasTabChange('body')
              setTrackView('recovery')
            }
          }}
          aria-label="Water: Go to recovery log"
        >
          <div className={lStyles.todayStripRing}>
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
              <circle cx="16" cy="16" r="13" fill="none" stroke="var(--surface3)" strokeWidth="3.5" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(200 85% 55%)" strokeWidth="3.5"
                strokeDasharray={`${(todayWaterPct / 100) * 81.68} 81.68`}
                strokeLinecap="round" strokeDashoffset="20.42"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <span>{privacyMode ? '—' : `${todayWaterPct}%`}</span>
          </div>
          <div className={lStyles.todayStripLabel}>
            <strong>Water</strong>
            <span>{privacyMode ? '—' : `${insights.waterGlassesToday} / ${todayWaterTarget} glasses`}</span>
          </div>
        </div>

        <div className={lStyles.todayStripDivider} aria-hidden="true" />

        <div 
          className={`${lStyles.todayStripItem} ${lStyles.todayStripItemInteractive}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            playTick()
            onLakasTabChange('body')
            setTrackView('activity')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              playTick()
              onLakasTabChange('body')
              setTrackView('activity')
            }
          }}
          aria-label="Steps: Go to activity log"
        >
          <div className={lStyles.todayStripRing}>
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
              <circle cx="16" cy="16" r="13" fill="none" stroke="var(--surface3)" strokeWidth="3.5" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(45 95% 55%)" strokeWidth="3.5"
                strokeDasharray={`${(todayStepPct / 100) * 81.68} 81.68`}
                strokeLinecap="round" strokeDashoffset="20.42"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <span>{privacyMode ? '—' : `${todayStepPct}%`}</span>
          </div>
          <div className={lStyles.todayStripLabel}>
            <strong>Steps</strong>
            <span>{privacyMode ? '—' : `${displayMetric(insights.stepsToday, '', privacyMode, 0)} / ${displayMetric(todayStepTarget, '', privacyMode, 0)}`}</span>
          </div>
        </div>

        <div 
          className={`${lStyles.todayStripItem} ${lStyles.todayStripItemInteractive}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            playTick()
            onLakasTabChange('body')
            setTrackView('recovery')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              playTick()
              onLakasTabChange('body')
              setTrackView('recovery')
            }
          }}
          aria-label="Habits: Go to recovery log"
        >
          <div className={lStyles.todayStripRing}>
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
              <circle cx="16" cy="16" r="13" fill="none" stroke="var(--surface3)" strokeWidth="3.5" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(280 70% 60%)" strokeWidth="3.5"
                strokeDasharray={`${(todayHabitPct / 100) * 81.68} 81.68`}
                strokeLinecap="round" strokeDashoffset="20.42"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <span>{privacyMode ? '—' : `${todayHabitPct}%`}</span>
          </div>
          <div className={lStyles.todayStripLabel}>
            <strong>Habits</strong>
            <span>{privacyMode ? '—' : `${insights.habitScoreToday} / ${HABIT_OPTIONS.length} done`}</span>
          </div>
        </div>
      </div>

      {almostDoneGoals.length > 0 && (
        <div className={lStyles.goalsNudgeRow}>
          {almostDoneGoals.map(goal => {
            const target = numberOrZero(goal.target)
            const current = numberOrZero(goal.current)
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
            return (
              <div 
                key={`nudge-${goal._id}`} 
                className={lStyles.goalNudgeChip}
                onClick={() => {
                  onLakasTabChange('body');
                  setTrackView('goals');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <span className={lStyles.goalNudgeIcon}>🎯</span>
                <span>
                  <strong>Almost there!</strong> Goal <em>"{goal.name}"</em> is at <strong>{pct}%</strong> ({current}/{target} {goal.unit || ''})
                </span>
              </div>
            )
          })}
        </div>
      )}

        {(showWorkouts || showWorkoutLog) && (
      <div className={lStyles.grid}>
        {showWorkouts && (
        <>
	        <section className={`${lStyles.panel} ${lStyles.workoutLaunchPad}`}>
		          <div className={lStyles.sectionHeader}>
		            <div>
		              <div className={lStyles.sectionKicker}>Workout</div>
		              <h3>Start one workout. Watch the form. Log the real work.</h3>
	                <p className={lStyles.sectionHint}>Lakas leads with one recommended session first. Exercise videos and cues open inside session mode, then the logger stays close while you train.</p>
		            </div>
		          </div>
	          <div className={lStyles.workoutHero}>
	            <div className={lStyles.workoutLaunchGrid}>
	              <article className={`${lStyles.workoutLaunchCard} ${lStyles.workoutPrimaryCard} ${lStyles.workoutHeroCard}`}>
	                <span>Start here today</span>
	                <strong>{featuredWorkoutTemplate?.name || 'Guided session'}</strong>
	                <small>
	                  {featuredWorkoutTemplate
	                    ? `${featuredWorkoutSession.label} · ${normalizeRows(featuredWorkoutTemplate.exercises).length} exercises`
	                    : 'Open the recommended start before browsing everything else.'}
	                </small>
	                <div className={lStyles.todayLaunchPills}>
	                  <span>{featuredWorkoutEstimate} min</span>
	                  <span>{featuredWorkoutDifficulty}</span>
	                  <span>{featuredWorkoutPlace}</span>
	                </div>
	                <div className={lStyles.todayLaunchMeta}>
	                  <strong>{coachingSystem.profile.goalLabel}</strong>
	                  <p>{coachingSystem.workout.recommendedReason}</p>
	                </div>
	                <div className={`${lStyles.workoutLaunchActions} ${lStyles.workoutHeroActions}`}>
	                  <Button type="button" variant="primary" fullWidth onClick={() => openGymSessionMode(featuredWorkoutTemplate, featuredWorkoutSession)}>
	                    Start workout + video
	                  </Button>
	                  <Button type="button" variant="ghost" fullWidth onClick={openWorkoutPathChooser}>
	                    Change today&apos;s program
	                  </Button>
	                </div>
	              </article>

	              <div className={lStyles.workoutSupportGrid}>
	                <article className={`${lStyles.workoutLaunchCard} ${lStyles.workoutRecommendationCard} ${lStyles.workoutSupportCard}`}>
	                  <span>Recovery</span>
	                  <strong>{coachingSystem.profile.recovery.label}</strong>
	                  <small>{coachingSystem.profile.recovery.detail}</small>
	                  <div className={lStyles.todayLaunchMeta}>
	                    <strong>{privacyMode ? `.../${HABIT_OPTIONS.length}` : `${insights.habitScoreToday}/${HABIT_OPTIONS.length}`}</strong>
	                    <p>Recovery check-ins decide whether today should push, stay steady, or reset.</p>
	                  </div>
	                </article>

	                <article className={`${lStyles.workoutLaunchCard} ${lStyles.workoutSupportCard}`}>
	                  <span>Nutrition</span>
	                  <strong>{coachingSystem.profile.nutritionMode}</strong>
	                  <small>{coachingSystem.nutrition.summary}</small>
	                  <div className={lStyles.todayLaunchPills}>
	                    <span>{displayMetric(coachingSystem.nutrition.calorieTarget, 'kcal target', privacyMode, 0)}</span>
	                    <span>{displayMetric(coachingSystem.nutrition.proteinTarget, 'g protein', privacyMode, 0)}</span>
	                  </div>
	                </article>

	                <article className={`${lStyles.workoutLaunchCard} ${lStyles.workoutSupportCard}`}>
	                  <span>Progress</span>
	                  <strong>{coachingSystem.progress.title}</strong>
	                  <small>{coachingSystem.progress.body}</small>
	                  <div className={lStyles.todayLaunchPills}>
	                    <span>{displayMetric(insights.workoutsThisWeek, 'workouts this week', privacyMode, 0)}</span>
	                    <span>Target {displayMetric(weeklyWorkoutTarget, 'wk', privacyMode, 0)}</span>
	                  </div>
	                  <div className={lStyles.todayLaunchMeta}>
	                    <strong>{coachingSystem.progress.weightTrend.label}</strong>
	                    <p>{workoutsLeftThisWeek === 0 ? 'You can hold the line with a lighter day.' : `${workoutsLeftThisWeek} workout${workoutsLeftThisWeek === 1 ? '' : 's'} left to hit this week cleanly.`}</p>
	                  </div>
	                </article>
	              </div>
	            </div>

	            <div className={`${lStyles.workoutSecondaryRow} ${lStyles.workoutPrimaryActionRow}`}>
	              <button type="button" className={lStyles.workoutSecondaryAction} onClick={openWorkoutPathChooser}>
	                <span>Change program</span>
	                <strong>{selectedGymSession.label}</strong>
	                <small>{coachingSystem.workout.selectedPathReason}</small>
	              </button>
	              <button type="button" className={lStyles.workoutSecondaryAction} onClick={openProgramsPanel}>
	                <span>Browse routines</span>
	                <strong>Starter programs and saved routines</strong>
	                <small>Open the full routine library only when today needs a different shape.</small>
	              </button>
	              <button
	                type="button"
	                className={lStyles.workoutSecondaryAction}
	                onClick={() => {
	                  setWorkoutLogOpen(true)
	                  requestAnimationFrame(() => workoutLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
	                }}
	              >
	                <span>Quick log</span>
	                <strong>Record what really happened</strong>
	                <small>Skip videos and guidance only when you already know the session.</small>
	              </button>
	            </div>
	          </div>

	          <details
	            ref={workoutPathRef}
	            className={lStyles.guidanceDetails}
	            open={pathChooserOpen}
	            onToggle={event => setPathChooserOpen(event.currentTarget.open)}
	          >
	            <summary className={lStyles.advancedSummary}>
	              <span>Change the program or open the routines library</span>
	              <small>Only open this when today needs a different workout shape.</small>
	            </summary>
	            <div className={lStyles.sessionPicker} aria-label="Choose today&apos;s workout program">
	              {todayPathOptions.map(option => (
	                <button
	                  key={option.key}
	                  type="button"
	                  className={`${lStyles.sessionChip} ${selectedGymSessionKey === option.key ? lStyles.sessionChipActive : ''}`}
	                  onClick={() => setSelectedGymSessionKey(option.key)}
	                  aria-pressed={selectedGymSessionKey === option.key}
	                >
	                  <strong>{option.title}</strong>
	                  <span>{option.meta}</span>
	                </button>
	              ))}
	            </div>
	            <div className={`${lStyles.todayGuidanceGrid} ${lStyles.pathChooserSupport}`}>
	              <article className={lStyles.todayGuidanceCard}>
	                <span className={lStyles.todayGuidanceEyebrow}>Current program</span>
	                <div className={lStyles.todayGuidanceList}>
	                  <div className={lStyles.todayGuidanceNote}>
	                    <strong>{selectedGymSession.label}</strong>
	                    <span>{coachingSystem.workout.selectedPathReason}</span>
	                    <small>{todayPathOptions.find(option => option.key === selectedGymSessionKey)?.meta || selectedGymSession.desc}</small>
	                  </div>
	                </div>
	              </article>
	              <article className={lStyles.todayGuidanceCard}>
	                <span className={lStyles.todayGuidanceEyebrow}>Routines library</span>
	                <div className={lStyles.todayGuidanceList}>
	                  <div className={lStyles.todayGuidanceNote}>
	                    <strong>Saved routines and starter programs</strong>
	                    <span>Browse the full library without losing today&apos;s recommended start.</span>
	                    <small>Use this when you want to repeat a saved workout or pick a more deliberate program.</small>
	                  </div>
	                </div>
	                <div className={lStyles.workoutLaunchActions}>
	                  <Button type="button" variant="ghost" fullWidth onClick={openProgramsPanel}>
	                    Open routines library
	                  </Button>
	                </div>
	              </article>
	            </div>
	          </details>

          <details className={lStyles.advancedBox}>
            <summary className={lStyles.advancedSummary}>
              <span>Full workout details and form help</span>
              <small>Exercise list, quick cues, swaps, progression notes, and deeper coaching.</small>
            </summary>
            <div className={lStyles.todayGuidanceGrid}>
              <article className={lStyles.todayGuidanceCard}>
                <span className={lStyles.todayGuidanceEyebrow}>Today&apos;s cues</span>
                <div className={lStyles.todayGuidanceList}>
                  {selectedTemplateCues.length ? selectedTemplateCues.map(item => (
                    <div key={`${selectedGymTemplate.name}-${item.exercise}`} className={lStyles.todayGuidanceNote}>
                      <strong>{item.exercise}</strong>
                      <span>{item.guide.setup}</span>
                      <small>{item.guide.safety}</small>
                    </div>
                  )) : (
                    <div className={lStyles.todayGuidanceNote}>
                      <strong>Keep the reps clean</strong>
                      <span>Move slowly, keep a little effort in reserve, and stop when form breaks.</span>
                      <small>Lakas uses guidance to get you started, then the logger captures the real session.</small>
                    </div>
                  )}
                </div>
              </article>

              <article className={lStyles.todayGuidanceCard}>
                <span className={lStyles.todayGuidanceEyebrow}>Easy swaps</span>
                <div className={lStyles.todayGuidanceList}>
                  {selectedTemplateAlternatives.length ? selectedTemplateAlternatives.map(item => (
                    <div key={`${selectedGymTemplate.name}-${item.exercise}-alt`} className={lStyles.todayGuidanceNote}>
                      <strong>{item.exercise}</strong>
                      <span>{item.alternative}</span>
                      <small>Keep the habit moving even when setup, equipment, or energy changes.</small>
                    </div>
                  )) : (
                    <div className={lStyles.todayGuidanceNote}>
                      <strong>No swap needed yet</strong>
                      <span>This session already matches a lower-barrier setup.</span>
                      <small>Use the same pattern twice before you chase more complexity.</small>
                    </div>
                  )}
                </div>
              </article>
            </div>
            <div className={lStyles.gymSessionLayout}>
              <div className={lStyles.gymSessionSummary}>
                <div className={lStyles.gymSessionEyebrow}>{selectedGymSession.label}</div>
                <h4>{selectedGymTemplate.name}</h4>
                <p>{buildTemplateNotes(selectedGymTemplate) || selectedGymSession.desc}</p>
                <div className={lStyles.gymSessionStats}>
                  <span>{selectedGymExercises.length} exercises</span>
                  <span>{selectedGymEstimate} min routine</span>
                  <span>{selectedGymTemplate.focus}</span>
                  {selectedGymSession.key === 'beginner' && <span>{beginnerProgression.trackLabel}</span>}
                </div>
                {selectedGymSession.key === 'beginner' && (
                  <div className={lStyles.sessionCoachInline}>
                    <div className={lStyles.sessionCoachInlineTop}>
                      <span>Recommended next move</span>
                      <strong>{beginnerProgression.phase.title}</strong>
                    <p>{beginnerProgression.nextAction} The session opens with form video and cues before you log sets.</p>
                    </div>
                    <div className={lStyles.sessionCoachInlineMeta}>
                      <small>{privacyMode ? 'Private' : `${beginnerProgression.completed}/8`} foundation sessions</small>
                      <small>{beginnerProgression.weeklyTarget}</small>
                      <small>{privacyMode ? 'Private' : beginnerProgression.lastSessionLabel}</small>
                    </div>
	                    <div className={lStyles.sessionCoachRuleList}>
	                      {beginnerProgression.rules.slice(0, 3).map(rule => <span key={rule}>{rule}</span>)}
	                      {beginnerProgression.rules.length > 3 ? <span>More roadmap below</span> : null}
	                    </div>
	                  </div>
	                )}
                <div className={lStyles.gymSessionActions}>
                  <Button type="button" variant="primary" fullWidth onClick={() => openGymSessionMode(selectedGymTemplate, selectedGymSession)}>
                    Start with video
                  </Button>
                  <Button type="button" variant="ghost" fullWidth onClick={() => {
                    openProgramsPanel()
                    editGymSessionAsRoutine(selectedGymTemplate)
                  }}>
                    Edit as routine
                  </Button>
                </div>
              </div>

              <div className={lStyles.gymExerciseList}>
                <div className={lStyles.gymExerciseSectionNote}>
                  <strong>Exercise list</strong>
                  <span>Keep the card face short. Open any movement only if you want deeper cues or safety notes.</span>
                  <small>Start the session to see exercise video beside the logger while the workout is running.</small>
                </div>
                {selectedGymExercises.map((exercise, index) => {
                  const guide = getExerciseGuide(exercise.name)
                  const primaryCue = guide?.setup || exercise.notes || 'Move with control and stop before form breaks.'
                  return (
                    <article key={`${selectedGymTemplate.name}-${exercise.name}`} className={lStyles.gymExerciseCard}>
                      <div className={lStyles.gymExerciseTop}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <strong>{exercise.name}</strong>
                      </div>
                      <div className={lStyles.gymExerciseMeta}>
                        <span>{exercise.sets || 1} sets</span>
                        <span>{exercise.reps ? `${exercise.reps} reps` : `${Math.round(numberOrZero(exercise.duration) / 60)} min`}</span>
                        <span>{exercise.rest || 0}s rest</span>
                        <span>{estimateExerciseMinutes(exercise)} min</span>
                      </div>
                      <small className={lStyles.gymExerciseLoad}>{getExerciseLoadHint(exercise.name, savedLakasSettings)}</small>
                      <p className={lStyles.gymExerciseCue}>{primaryCue}</p>
                      {(guide?.safety || exercise.notes) && (
                        <details className={lStyles.gymExerciseDetails}>
                          <summary>More cues</summary>
                          <div className={lStyles.gymExerciseDetailsBody}>
                            {guide?.safety ? <p>{guide.safety}</p> : null}
                            {exercise.notes ? <small>{exercise.notes}</small> : null}
                            <span className={lStyles.gymExerciseVideoHint}>Video opens when you start the session</span>
                          </div>
                        </details>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>

            <div className={lStyles.gymSessionSafety}>
              Safety rule: if form breaks, pain feels sharp, or recovery feels bad, reduce load, reduce range, or stop the set. Lakas is a tracker, not medical advice.
            </div>
            <details className={lStyles.advancedBox}>
              <summary className={lStyles.advancedSummary}>
                <span>Program roadmap and form help</span>
                <small>Open this only when you want the longer explanation behind the session.</small>
              </summary>
              <div className={lStyles.gymKnowledgeStack}>
                <details className={lStyles.gymKnowledgeSection}>
                  <summary className={lStyles.gymKnowledgeSummary}>
                    <span>Program roadmap</span>
                    <small>See how the beginner program progresses before you worry about perfect optimization.</small>
                  </summary>
                  <div className={lStyles.advancedGrid}>
                    {BEGINNER_PHASES.map(phase => (
                      <div key={phase.title} className={lStyles.phaseCard}>
                        <strong>{phase.title}</strong>
                        <span>{phase.desc}</span>
                      </div>
                    ))}
                  </div>
                </details>
                <details className={lStyles.gymKnowledgeSection}>
                  <summary className={lStyles.gymKnowledgeSummary}>
                    <span>Form cues by movement</span>
                    <small>Quick coaching reminders for squat, press, pull, and hinge patterns.</small>
                  </summary>
                  <div className={lStyles.formGuideGrid} style={{ padding: '0 12px 12px' }}>
                    {FORM_GUIDES.slice(0, 4).map(guide => (
                      <div key={guide.name} className={lStyles.formGuideCard}>
                        <strong>{guide.name}</strong>
                        <span>{guide.setup}</span>
                        <small>{guide.safety}</small>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </details>
          </details>
        </section>
        </>
        )}

        {showWorkoutLog && (
        <details
          ref={workoutLogRef}
          className={`${lStyles.advancedBox} ${lStyles.workoutFollowupBox}`}
          open={workoutLogOpen}
          onToggle={event => setWorkoutLogOpen(event.currentTarget.open)}
        >
          <summary className={lStyles.advancedSummary}>
            <span>Log a workout manually</span>
            <small>Use this when you already know what you did and just want to save the real session fast.</small>
          </summary>
          <div className={lStyles.advancedBody}>
          <div className={lStyles.guidedHandoffCard}>
            <div>
              <span>Guided handoff</span>
              <strong>{selectedGymTemplate.name}</strong>
              <p>
                {matchedTemplateHistoryCount
                  ? `${matchedTemplateHistoryCount} of ${selectedGymExercises.length} exercises already have previous values ready in the editor.`
                  : 'Load today’s guided session into the log first if you want to edit the workout before you start.'}
              </p>
            </div>
            <div className={lStyles.guidedHandoffMeta}>
              <small>{selectedGymEstimate} min · {selectedWorkoutDifficulty} · {coachingSystem.profile.preferredWorkoutPlace}</small>
              <small>
                {selectedTemplateAlternatives[0]?.alternative
                  || getExerciseLoadHint(selectedGymExercises[0]?.name, savedLakasSettings)
                  || 'Keep the logger close to the guided session, then save the real workout once it is done.'}
              </small>
            </div>
            <div className={lStyles.guidedHandoffActions}>
              <Button type="button" variant="secondary" fullWidth onClick={() => loadWorkoutTemplate(selectedGymTemplate, selectedGymSession)}>
                Load guided log
              </Button>
              <Button type="button" variant="ghost" fullWidth onClick={() => openGymSessionMode(selectedGymTemplate, selectedGymSession)}>
                Start session instead
              </Button>
            </div>
          </div>
          <div className={lStyles.formGrid}>
            <label className={lStyles.full}>
              <span>Use routine</span>
              <select value={workoutForm.routineId} onChange={event => handleRoutineSelect(event.target.value)}>
                <option value="">No routine selected</option>
                {routines.map(routine => <option key={routine._id} value={routine._id}>{routine.name}</option>)}
              </select>
            </label>
            <label>
              <span>Workout name</span>
              <input ref={workoutNameInputRef} value={workoutForm.title} placeholder="Push day, Full body, Run" onChange={event => setWorkoutForm(current => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              <span>Date</span>
              <div className={styles.dateFieldWrap}>
                <div className={styles.dateFieldDisplay}>
                  {formatDisplayDate(workoutForm.date)}
                </div>
                <input
                  type="date"
                  className={styles.dateFieldNative}
                  value={workoutForm.date}
                  onChange={event => setWorkoutForm(current => ({ ...current, date: event.target.value }))}
                />
              </div>
            </label>
          </div>
          <details className={lStyles.advancedBox}>
            <summary className={lStyles.advancedSummary}>
              <span>Session details</span>
              <small>Duration and notes</small>
            </summary>
            <div className={lStyles.advancedGrid}>
              <label>
                <span>Duration (min)</span>
                <input type="number" min="0" inputMode="decimal" value={workoutForm.duration} placeholder="60" onChange={event => setWorkoutForm(current => ({ ...current, duration: event.target.value }))} />
              </label>
              <label>
                <span>Notes</span>
                <input value={workoutForm.notes} placeholder="Energy, soreness, form notes" onChange={event => setWorkoutForm(current => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>
          </details>
          {renderExerciseEditor(workoutForm.exercises, setWorkoutForm, 'Workout exercises')}
          <Button type="button" variant="primary" fullWidth onClick={handleAddWorkout}>Save workout</Button>
          <div className={lStyles.inlineSection}>
            <div className={lStyles.inlineSectionHeader}>
              <strong>Recent workouts</strong>
              <span>Keep the last few sessions close while you log the next one.</span>
            </div>
            {!workouts.length ? <EmptyState compact>No workouts logged yet.</EmptyState> : workouts.slice(0, 2).map(workout => (
              <div key={workout._id} className={lStyles.rowCard}>
                <div>
                  <strong>{workout.title}</strong>
                  <span>{formatDisplayDate(workout.date)} · {getResolvedRoutineDuration(workout.duration, workout.exercises, savedLakasSettings.workoutDefaults.durationMinutes)} min · {workout.exerciseCount || 0} exercises · {workout.setCount || 0} sets · {formatNumber(workout.volume || getExerciseTotals(workout.exercises).volume)} {savedLakasSettings.units.weight} volume</span>
                  {Array.isArray(workout.exercises) && workout.exercises.length > 0 && (
                    <small>{normalizeRows(workout.exercises).slice(0, 3).map(row => formatExerciseLine(row, privacyMode, savedLakasSettings.units.weight)).join(' | ')}</small>
                  )}
                  {typeof workout.exercises === 'string' && workout.exercises && (
                    <small>{workout.exercises.split('\n').slice(0, 2).join(' | ')}</small>
                  )}
                </div>
                <div className={lStyles.rowActions}>
                  <button type="button" onClick={() => copyWorkoutIntoLog(workout)}>Repeat</button>
                  <button type="button" onClick={() => {
                    openProgramsPanel()
                    turnWorkoutIntoRoutine(workout)
                  }}>Build routine</button>
                  <button type="button" onClick={async () => { if (await confirmDeleteApp(workout.title)) await fsDel(user.uid, 'lakasWorkouts', workout._id) }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </details>
        )}

        {showWorkouts && (
        <details
          ref={programsRef}
          className={`${lStyles.advancedBox} ${lStyles.workoutFollowupBox}`}
          open={programsOpen}
          onToggle={event => setProgramsOpen(event.currentTarget.open)}
        >
          <summary className={lStyles.advancedSummary}>
            <span>Browse routines</span>
            <small>Open your reusable templates only when you want something beyond today&apos;s recommended start.</small>
          </summary>
          <div className={lStyles.advancedBody}>
          <section className={lStyles.programCallout}>
            <div className={lStyles.programCalloutCopy}>
              <span className={lStyles.programCalloutEyebrow}>Recomp starter</span>
              <strong>Low muscle + soft waist: start with muscle-building consistency.</strong>
              <p>
                This program is for people who feel skinny-fat or under-muscled. Train three days per week,
                leave a few reps in reserve, and let food quality plus walking tighten things up slowly.
              </p>
              <ul className={lStyles.programCalloutList}>
                {RECOMP_STARTER_RULES.map(rule => <li key={rule}>{rule}</li>)}
              </ul>
            </div>
            <div className={lStyles.programCalloutActions}>
              {recompStarterTemplates.map(template => (
                <Button
                  key={`callout-${template.name}`}
                  type="button"
                  variant="secondary"
                  onClick={() => openGymSessionMode(template, {
                    key: normalizeExerciseKey(template.name),
                    label: template.name,
                    templateName: template.name,
                    desc: template.notes || 'Guided recomposition routine',
                  })}
                >
                  Start {template.name.replace('Recomp ', '')}
                </Button>
              ))}
            </div>
          </section>
          <div className={lStyles.routineSpotlightGrid}>
            {BUILT_IN_ROUTINES.slice(0, 4).map(template => (
              <article key={`spotlight-${template.name}`} className={lStyles.routineSpotlightCard}>
                <div>
                  <span>{template.difficulty || template.focus || 'Routine'}</span>
                  <strong>{template.name}</strong>
                  <small>{template.duration || estimateRoutineMinutes(template.exercises)} min · {normalizeRows(template.exercises).length} exercises</small>
                </div>
                <div className={lStyles.routineActions}>
                  <button type="button" onClick={() => openGymSessionMode(template, {
                    key: normalizeExerciseKey(template.name),
                    label: template.name,
                    templateName: template.name,
                    desc: template.notes || 'Guided routine',
                  })}>Start</button>
                  <button type="button" onClick={() => applyRoutineTemplate(template)}>Edit</button>
                </div>
              </article>
            ))}
          </div>
          {!groupedRoutines.length ? (
            <EmptyState compact>No saved routines yet. Use a starter template above or save your own routine below.</EmptyState>
          ) : (
            <div className={lStyles.routineGroupList}>
              {groupedRoutines.map(group => (
                <section key={group.label} className={lStyles.routineGroup}>
                  <div className={lStyles.routineGroupHeader}>
                    <strong>{group.label}</strong>
                    <span>{group.description}</span>
                  </div>
                  <div className={lStyles.routineList}>
                    {group.rows.slice(0, 3).map(routine => (
                      <div key={routine._id} className={lStyles.routineCard}>
                        <div>
                          <strong>{routine.name}</strong>
                          <span>{routine.focus || 'Routine'} · {getResolvedRoutineDuration(routine.duration, routine.exercises, savedLakasSettings.workoutDefaults.durationMinutes)} min · {routine.exerciseCount || 0} exercises · {routine.setCount || 0} sets</span>
                          {Array.isArray(routine.exercises) && routine.exercises.length > 0 && (
                            <small>{normalizeRows(routine.exercises).slice(0, 3).map(row => formatExerciseLine(row, privacyMode, savedLakasSettings.units.weight)).join(' | ')}</small>
                          )}
                        </div>
                        <div className={lStyles.routineActions}>
                          <button type="button" onClick={() => {
                            setWorkoutLogOpen(true)
                            loadRoutine(routine)
                          }}>Use</button>
                          <button type="button" onClick={() => editRoutine(routine)}>Edit</button>
                          <button type="button" onClick={async () => { if (await confirmDeleteApp(routine.name)) await fsDel(user.uid, 'lakasRoutines', routine._id) }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          <details className={lStyles.advancedBox}>
            <summary className={lStyles.advancedSummary}>
              <span>Browse the guided library and edit routines</span>
              <small>Starter programs, routines, focus, duration, and exercise list</small>
            </summary>
            <div className={lStyles.advancedBody}>
              <div className={lStyles.routineLibrary}>
                {groupedBuiltInRoutines.map(group => (
                  <section key={group.label} className={lStyles.libraryGroup}>
                    <div className={lStyles.libraryGroupHeader}>
                      <strong>{group.label}</strong>
                      <span>{group.description}</span>
                    </div>
                    <div className={lStyles.templateRow}>
                      {group.rows.map(template => (
                        <button key={template.name} type="button" className={`${lStyles.templateCard} ${template.difficulty === 'Beginner' ? lStyles.templateCardBeginner : ''}`} onClick={() => applyRoutineTemplate(template)}>
                          <strong>{template.name}</strong>
                          <span>{template.difficulty || template.focus}{template.weeks ? ` · ${template.weeks}` : ''}</span>
                          {template.progression && <small>{template.progression}</small>}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className={lStyles.formGrid}>
                <label>
                  <span>Routine name</span>
                  <input value={routineForm.name} placeholder="Push day, Legs, 5K prep" onChange={event => setRoutineForm(current => ({ ...current, name: event.target.value }))} />
                </label>
                <label>
                  <span>Focus</span>
                  <select value={routineForm.focus} onChange={event => setRoutineForm(current => ({ ...current, focus: event.target.value }))}>
                    {ROUTINE_FOCUS.map(focus => <option key={focus}>{focus}</option>)}
                  </select>
                </label>
                <label>
                  <span>Target duration (min)</span>
                  <input type="number" min="0" inputMode="decimal" value={routineForm.duration} placeholder="60" onChange={event => setRoutineForm(current => ({ ...current, duration: event.target.value }))} />
                </label>
                <label>
                  <span>Notes</span>
                  <input value={routineForm.notes} placeholder="Progression, warmup, target RPE" onChange={event => setRoutineForm(current => ({ ...current, notes: event.target.value }))} />
                </label>
              </div>
              {renderExerciseEditor(routineForm.exercises, setRoutineForm, 'Routine exercises')}
              <Button type="button" variant="primary" fullWidth onClick={handleAddRoutine}>Save routine</Button>
            </div>
          </details>
          </div>
        </details>
        )}

      </div>
      )}

      {(showBody || showGoals || showMovement || showRecovery || showMeals) && (
      <div className={lStyles.grid}>
        {showTrackSwitcher && (
          <section className={lStyles.viewSwitchCard} aria-label="Choose what to update">
            <div className={lStyles.viewSwitchHeader}>
              <div>
                <div className={lStyles.sectionKicker}>Body system</div>
                <h3>Food, body, movement, and recovery now live in one calmer hub.</h3>
                <p className={lStyles.sectionHint}>Choose the one thing you want to update, keep the other signals visible, and avoid bouncing between disconnected screens.</p>
              </div>
            </div>
            <div className={lStyles.bodyQuickStartGrid} role="tablist" aria-label="Choose what to update in Lakas">
              {LAKAS_TRACK_VIEWS.map(view => {
                const meta = view.id === 'goals'
                  ? activeGoalCount
                    ? `${activeGoalCount} active targets`
                    : 'Longer-term targets'
                  : view.meta
                return (
                  <button
                    key={view.id}
                    type="button"
                    className={`${lStyles.viewSwitchButton} ${view.id === 'goals' ? lStyles.bodyQuickStartButtonWide : ''} ${safeTrackView === view.id ? lStyles.viewSwitchButtonActive : ''}`}
                    onClick={() => setTrackView(view.id)}
                    role="tab"
                    aria-selected={safeTrackView === view.id}
                  >
                    <strong>{view.label}</strong>
                    <span>{meta}</span>
                  </button>
                )
              })}
            </div>
            <div className={lStyles.bodyOverviewGrid}>
              {bodyOverviewCards.map(card => (
                <article key={card.label} className={lStyles.bodyOverviewCard}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.meta}</small>
                </article>
              ))}
            </div>
            <div className={lStyles.bodyQuickStartNote}>
              <div>
                <span>Current focus</span>
                <strong>{currentBodyTrackView.label}</strong>
                <small>{bodyQuickStartSummary}</small>
              </div>
              <div className={lStyles.bodyQuickStartActions}>
                <Button type="button" variant="ghost" onClick={() => setTrackView('meals')}>
                  Log meal
                </Button>
                <Button type="button" variant="ghost" onClick={() => setTrackView('body')}>
                  Body check-in
                </Button>
                <Button type="button" variant="ghost" onClick={() => setTrackView('recovery')}>
                  Recovery
                </Button>
              </div>
            </div>
          </section>
        )}

        {showMeals && (
        <section ref={mealQuickActionRef} className={`${lStyles.panel} ${lStyles.quickEntryPanel}`}>
          <div className={lStyles.sectionHeader}>
            <div>
              <div className={lStyles.sectionKicker}>Meal log</div>
              <h3>Log meal details</h3>
              <p className={lStyles.sectionHint}>Manual meal logging first. Add calories, macros, and notes without depending on photo capture.</p>
            </div>
          </div>

          {/* Macro Distribution Ring */}
          <div className={lStyles.macroRingContainer}>
            <div className={lStyles.macroRingSvgWrapper}>
              <svg width="160" height="160" viewBox="0 0 160 160" className={lStyles.macroSvg}>
                <defs>
                  <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff5722" />
                    <stop offset="100%" stopColor="#ff9800" />
                  </linearGradient>
                  <linearGradient id="protGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4caf50" />
                    <stop offset="100%" stopColor="#8bc34a" />
                  </linearGradient>
                  <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00bcd4" />
                    <stop offset="100%" stopColor="#2196f3" />
                  </linearGradient>
                </defs>

                {/* Calorie Ring */}
                <circle cx="80" cy="80" r="70" className={lStyles.ringBg} strokeWidth="10" />
                <circle 
                  cx="80" cy="80" r="70" 
                  className={lStyles.ringFill} 
                  strokeWidth="10"
                  stroke="url(#calGrad)"
                  strokeDasharray={2 * Math.PI * 70}
                  strokeDashoffset={(2 * Math.PI * 70) - (Math.min(1, insights.caloriesToday / (numberOrZero(savedLakasSettings.targets.calories) || numberOrZero(savedLakasSettings.meals.calorieGoal) || 2200)) * 2 * Math.PI * 70)}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />

                {/* Protein Ring */}
                <circle cx="80" cy="80" r="56" className={lStyles.ringBg} strokeWidth="10" />
                <circle 
                  cx="80" cy="80" r="56" 
                  className={lStyles.ringFill} 
                  strokeWidth="10"
                  stroke="url(#protGrad)"
                  strokeDasharray={2 * Math.PI * 56}
                  strokeDashoffset={(2 * Math.PI * 56) - (Math.min(1, insights.proteinToday / (numberOrZero(savedLakasSettings.targets.protein) || numberOrZero(savedLakasSettings.meals.proteinGoal) || 120)) * 2 * Math.PI * 56)}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />

                {/* Water Ring */}
                <circle cx="80" cy="80" r="42" className={lStyles.ringBg} strokeWidth="10" />
                <circle 
                  cx="80" cy="80" r="42" 
                  className={lStyles.ringFill} 
                  strokeWidth="10"
                  stroke="url(#waterGrad)"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={(2 * Math.PI * 42) - (Math.min(1, (insights.waterGlassesToday || 0) / (Number(savedLakasSettings.targets.water) || 8)) * 2 * Math.PI * 42)}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />
              </svg>
            </div>
            <div className={lStyles.macroRingLegend}>
              <div className={lStyles.legendItem}>
                <span className={lStyles.legendDot} style={{ backgroundColor: '#ff5722' }} />
                <div>
                  <strong>Calories</strong>
                  <span>{privacyMode ? '***' : `${Math.round(insights.caloriesToday)} / ${numberOrZero(savedLakasSettings.targets.calories) || numberOrZero(savedLakasSettings.meals.calorieGoal) || 2200}`} kcal</span>
                </div>
              </div>
              <div className={lStyles.legendItem}>
                <span className={lStyles.legendDot} style={{ backgroundColor: '#4caf50' }} />
                <div>
                  <strong>Protein</strong>
                  <span>{privacyMode ? '***' : `${Math.round(insights.proteinToday)}g / ${numberOrZero(savedLakasSettings.targets.protein) || numberOrZero(savedLakasSettings.meals.proteinGoal) || 120}g`}</span>
                </div>
              </div>
              <div className={lStyles.legendItem}>
                <span className={lStyles.legendDot} style={{ backgroundColor: '#00bcd4' }} />
                <div>
                  <strong>Water</strong>
                  <span>{privacyMode ? '***' : `${insights.waterGlassesToday || 0} / ${savedLakasSettings.targets.water || 8}`} glasses</span>
                  {!privacyMode && (
                    <div className={lStyles.waterLegendControls}>
                      <button type="button" className={lStyles.waterLegendBtn} onClick={() => handleQuickAdjustWater(-1)}>−</button>
                      <button type="button" className={lStyles.waterLegendBtn} onClick={() => handleQuickAdjustWater(1)}>+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <section className={lStyles.nutritionCoachCard}>
            <div className={lStyles.nutritionCoachHeader}>
              <div>
                <span>{RECOMP_NUTRITION_GUIDE.title}</span>
                <strong>Eat to recover, build, and slowly tighten up.</strong>
              </div>
              <Button type="button" variant="secondary" onClick={applyRecompStarterDefaults} fullWidth>
                Use starter defaults
              </Button>
            </div>
            <p className={lStyles.nutritionCoachBody}>{RECOMP_NUTRITION_GUIDE.body}</p>
            <div className={lStyles.nutritionCoachGrid}>
              <div className={lStyles.nutritionCoachPane}>
                <strong>Daily target</strong>
                <small>
                  {recompReferenceWeight
                    ? `From your latest saved weight, start around ${recompDefaults.proteinGoal}g protein/day.`
                    : `If no body weight is saved yet, start with about ${recompDefaults.proteinGoal}g protein/day.`}
                </small>
                <small>Calories: stay around maintenance or only a small deficit. Do not crash cut.</small>
                <small>Walking: {recompDefaults.steps.toLocaleString('en-PH')}+ steps/day when possible.</small>
              </div>
              <div className={lStyles.nutritionCoachPane}>
                <strong>Main habits</strong>
                {RECOMP_NUTRITION_GUIDE.habits.map(item => <small key={item}>{item}</small>)}
              </div>
              <div className={lStyles.nutritionCoachPane}>
                <strong>Simple meal structure</strong>
                {RECOMP_NUTRITION_GUIDE.meals.map(item => <small key={item}>{item}</small>)}
              </div>
            </div>
          </section>

          <div className={lStyles.presetRow}>
            {FOOD_PRESETS.slice(0, 6).map(food => (
              <button key={food.name} type="button" className={lStyles.chip} onClick={() => applyFoodPreset(food)}>
                {food.name}
              </button>
            ))}
          </div>

          {/* Quick-Tap Meal Combos */}
          {savedLakasSettings.mealCombos && savedLakasSettings.mealCombos.length > 0 && (
            <div className={lStyles.customPresetContainer}>
              <div className={lStyles.customPresetHeader}>
                <strong>Your quick combos:</strong>
              </div>
              <div className={lStyles.presetRow}>
                {savedLakasSettings.mealCombos.map((food, idx) => (
                  <div key={idx} className={lStyles.comboChipWrapper}>
                    <button type="button" className={lStyles.chip} onClick={() => applyFoodPreset(food)}>
                      {food.name}
                    </button>
                    <button 
                      type="button" 
                      className={lStyles.deleteComboBtn} 
                      onClick={async (e) => { 
                        e.stopPropagation(); 
                        if (await confirmDeleteApp(`combo "${food.name}"`)) {
                          handleDeleteMealCombo(idx);
                        } 
                      }}
                      title="Delete combo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={lStyles.formGrid}>
            <label>
              <span>Meal</span>
              <input ref={mealNameInputRef} value={mealForm.name} placeholder="Chicken adobo with rice" onChange={event => setMealForm(current => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Type</span>
              <select value={mealForm.mealType} onChange={event => setMealForm(current => ({ ...current, mealType: event.target.value }))}>
                {MEAL_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Date</span>
              <div className={styles.dateFieldWrap}>
                <div className={styles.dateFieldDisplay}>
                  {formatDisplayDate(mealForm.date)}
                </div>
                <input
                  type="date"
                  className={styles.dateFieldNative}
                  value={mealForm.date}
                  onChange={event => setMealForm(current => ({ ...current, date: event.target.value }))}
                />
              </div>
            </label>
            <label>
              <span>Calories</span>
              <input type="number" min="0" inputMode="decimal" value={mealForm.calories} placeholder="450" onChange={event => setMealForm(current => ({ ...current, calories: event.target.value }))} />
            </label>
          </div>
          <details className={lStyles.advancedBox}>
            <summary className={lStyles.advancedSummary}>
              <span>Nutrition details</span>
              <small>Macros and notes</small>
            </summary>
            <div className={lStyles.advancedGrid}>
              <label>
                <span>Protein (g)</span>
                <input type="number" min="0" inputMode="decimal" value={mealForm.protein} placeholder="30" onChange={event => setMealForm(current => ({ ...current, protein: event.target.value }))} />
              </label>
              <label>
                <span>Carbs (g)</span>
                <input type="number" min="0" inputMode="decimal" value={mealForm.carbs} placeholder="50" onChange={event => setMealForm(current => ({ ...current, carbs: event.target.value }))} />
              </label>
              <label>
                <span>Fat (g)</span>
                <input type="number" min="0" inputMode="decimal" value={mealForm.fat} placeholder="12" onChange={event => setMealForm(current => ({ ...current, fat: event.target.value }))} />
              </label>
              <label>
                <span>Notes</span>
                <input value={mealForm.notes} placeholder="Portion notes, sauce, drink, etc." onChange={event => setMealForm(current => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>
          </details>
          <div className={lStyles.comboActionRow}>
            <Button type="button" variant="primary" fullWidth onClick={handleAddMeal} disabled={savingMeal}>
              {savingMeal ? 'Saving meal...' : 'Save meal'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleSaveMealCombo} fullWidth>
              Save as quick combo
            </Button>
          </div>
          <div className={lStyles.inlineSection}>
            <div className={lStyles.inlineSectionHeader}>
              <strong>Recent meals</strong>
              <span>Saved meals and macro estimates stay right below the form. Older archived images remain private-aware.</span>
            </div>
            {!meals.length ? <EmptyState compact>No meals logged yet.</EmptyState> : visibleMeals.map(meal => {
              const mealImage = mealPhotoUrls[meal._id] || meal.photoUrl || ''
              return (
                <div key={meal._id} className={lStyles.mealRow}>
                  {mealImage && !privacyMode ? <img src={mealImage} alt="" /> : <div className={lStyles.photoPlaceholder}>{mealImage || meal.photoPath ? 'Hidden' : 'Meal'}</div>}
                  <div>
                    <strong>{meal.name}</strong>
                    <span>{formatDisplayDate(meal.date)} · {meal.mealType} · {displayMetric(meal.calories, 'kcal', privacyMode)}</span>
                    <small>{displayMetric(meal.protein, 'g protein', privacyMode)} · {displayMetric(meal.carbs, 'g carbs', privacyMode)} · {displayMetric(meal.fat, 'g fat', privacyMode)}</small>
                  </div>
                  <button type="button" onClick={async () => { if (await confirmDeleteApp(meal.name)) await fsDeleteLakasMeal(user.uid, meal) }}>Delete</button>
                </div>
              )
            })}
          </div>
        </section>
        )}

        {showMovement && (
        <section className={lStyles.panel}>
          <div className={lStyles.sectionHeader}>
            <div>
              <div className={lStyles.sectionKicker}>Movement</div>
              <h3>Log movement</h3>
              <p className={lStyles.sectionHint}>Walks, runs, cardio, and active minutes stay here so everyday movement does not interrupt your workout history screens.</p>
            </div>
          </div>
          <div className={lStyles.formGrid}>
            <label>
              <span>Date</span>
              <div className={styles.dateFieldWrap}>
                <div className={styles.dateFieldDisplay}>
                  {formatDisplayDate(activityForm.date)}
                </div>
                <input
                  type="date"
                  className={styles.dateFieldNative}
                  value={activityForm.date}
                  onChange={event => setActivityForm(current => ({ ...current, date: event.target.value }))}
                />
              </div>
            </label>
            <label>
              <span>Type</span>
              <select value={activityForm.type} onChange={event => setActivityForm(current => ({ ...current, type: event.target.value }))}>
                {ACTIVITY_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Steps</span>
              <input type="number" min="0" inputMode="numeric" value={activityForm.steps} placeholder="8000" onChange={event => setActivityForm(current => ({ ...current, steps: event.target.value }))} />
            </label>
          </div>
          <details className={lStyles.advancedBox}>
            <summary className={lStyles.advancedSummary}>
              <span>More activity details</span>
              <small>Minutes, distance, notes</small>
            </summary>
            <div className={lStyles.advancedGrid}>
              <label>
                <span>Walk min</span>
                <input type="number" min="0" inputMode="numeric" value={activityForm.walkingMinutes} placeholder="30" onChange={event => setActivityForm(current => ({ ...current, walkingMinutes: event.target.value }))} />
              </label>
              <label>
                <span>Cardio min</span>
                <input type="number" min="0" inputMode="numeric" value={activityForm.cardioMinutes} placeholder="20" onChange={event => setActivityForm(current => ({ ...current, cardioMinutes: event.target.value }))} />
              </label>
              <label>
                <span>Active min</span>
                <input type="number" min="0" inputMode="numeric" value={activityForm.activeMinutes} placeholder="45" onChange={event => setActivityForm(current => ({ ...current, activeMinutes: event.target.value }))} />
              </label>
              <label>
                <span>Distance ({savedLakasSettings.units.distance})</span>
                <input type="number" min="0" inputMode="decimal" value={activityForm.distance} placeholder="3.5" onChange={event => setActivityForm(current => ({ ...current, distance: event.target.value }))} />
              </label>
              <label className={lStyles.full}>
                <span>Notes</span>
                <input value={activityForm.notes} placeholder="Easy pace, errands, commute" onChange={event => setActivityForm(current => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>
          </details>
          <Button type="button" variant="primary" fullWidth onClick={handleAddActivity}>Save activity</Button>
          <div className={lStyles.inlineSection}>
            <div className={lStyles.inlineSectionHeader}>
              <strong>Recent movement</strong>
              <span>Review the last few entries without leaving the movement log.</span>
            </div>
            {!activities.length ? <EmptyState compact>No activity logs yet.</EmptyState> : activities.slice(0, 4).map(activity => (
              <div key={activity._id} className={lStyles.rowCard}>
                <div>
                  <strong>{activity.type}</strong>
                  <span>{formatDisplayDate(activity.date)} · {displayMetric(activity.steps, 'steps', privacyMode, 0)} · {displayMetric(numberOrZero(activity.cardioMinutes) + numberOrZero(activity.walkingMinutes) + numberOrZero(activity.activeMinutes), 'active min', privacyMode, 0)}</span>
                  {activity.notes && <small>{activity.notes}</small>}
                </div>
                <button type="button" onClick={async () => { if (await confirmDeleteApp('this activity')) await fsDel(user.uid, 'lakasActivities', activity._id) }}>Delete</button>
              </div>
            ))}
          </div>
        </section>
        )}

        {showRecovery && (
        <section className={lStyles.panel}>
          <div className={lStyles.sectionHeader}>
            <div>
              <div className={lStyles.sectionKicker}>Recovery</div>
              <h3>Daily recovery</h3>
              <p className={lStyles.sectionHint}>Tick the basics quickly so recovery becomes visible without turning into a chore.</p>
            </div>
          </div>
          <div className={lStyles.formGrid}>
            <label className={lStyles.full}>
              <span>Date</span>
              <div className={styles.dateFieldWrap}>
                <div className={styles.dateFieldDisplay}>
                  {formatDisplayDate(habitForm.date)}
                </div>
                <input 
                  type="date" 
                  className={styles.dateFieldNative}
                  value={habitForm.date} 
                  onChange={event => {
                    const nextDate = event.target.value
                    const found = habits.find(h => h.date === nextDate)
                    setHabitForm({
                      date: nextDate,
                      water: found ? Boolean(found.water) : false,
                      waterGlasses: found ? numberOrZero(found.waterGlasses) : 0,
                      protein: found ? Boolean(found.protein) : false,
                      sleep: found ? Boolean(found.sleep) : false,
                      stretching: found ? Boolean(found.stretching) : false,
                      restDay: found ? Boolean(found.restDay) : false,
                      vitamins: found ? Boolean(found.vitamins) : false,
                      notes: found ? (found.notes || '') : '',
                    })
                  }} 
                />
              </div>
            </label>
          </div>

          {/* Interactive Hydration Tracker */}
          <div className={lStyles.waterBottleSection}>
            <div className={lStyles.waterBottleLeft}>
              <div className={lStyles.waterBottle}>
                <div className={lStyles.waterBottleCap} />
                <div className={lStyles.waterBottleNeck} />
                <div className={lStyles.waterBottleBody}>
                  <div 
                    className={lStyles.waterLiquid} 
                    style={{ height: `${Math.min(100, ((habitForm.waterGlasses || 0) / (Number(savedLakasSettings.targets.water) || 8)) * 100)}%` }} 
                  />
                  <div className={lStyles.waterBottleReflection} />
                </div>
              </div>
            </div>
            <div className={lStyles.waterBottleControls}>
              <strong>Hydration Tracker</strong>
              <p>Target: {savedLakasSettings.targets.water || 8} glasses</p>
              <div className={lStyles.waterRow}>
                <button type="button" className={lStyles.waterBtn} onClick={() => updateWaterGlasses((habitForm.waterGlasses || 0) - 1)}>−</button>
                <span className={lStyles.waterCount}>{habitForm.waterGlasses || 0} / {savedLakasSettings.targets.water || 8}</span>
                <button type="button" className={lStyles.waterBtn} onClick={() => updateWaterGlasses((habitForm.waterGlasses || 0) + 1)}>+</button>
              </div>
              <small className={lStyles.waterProgressKicker} style={{ color: habitForm.water ? '#4caf50' : '#0288d1' }}>
                {habitForm.water ? '🎉 Daily water goal achieved!' : 'Keep drinking to hit your daily goal.'}
              </small>
            </div>
          </div>

          <div className={lStyles.habitGrid}>
            {HABIT_OPTIONS.map(option => (
              <label key={option.key} className={`${lStyles.habitPill} ${habitForm[option.key] ? lStyles.habitPillActive : ''}`}>
                <input type="checkbox" checked={habitForm[option.key]} onChange={event => handleHabitChange(option.key, event.target.checked)} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className={lStyles.formGrid}>
            <label className={lStyles.full}>
              <span>Notes</span>
              <input value={habitForm.notes} placeholder="Sleep quality, soreness, mood, recovery" onChange={event => setHabitForm(current => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <Button type="button" variant="primary" fullWidth onClick={handleAddHabit}>Save check-in</Button>
          <div className={lStyles.inlineSection}>
            <div className={lStyles.inlineSectionHeader}>
              <strong>Recent check-ins</strong>
              <span>A lightweight recovery trail stays right beside the form.</span>
            </div>
            {!habits.length ? <EmptyState compact>No habit check-ins yet.</EmptyState> : habits.slice(0, 4).map(habit => (
              <div key={habit._id} className={lStyles.rowCard}>
                <div>
                  <strong>{formatDisplayDate(habit.date)} · {getHabitScore(habit)}/{HABIT_OPTIONS.length}</strong>
                  <span>{HABIT_OPTIONS.filter(option => habit[option.key]).map(option => option.label).join(' · ') || 'No habits ticked'}</span>
                  {habit.waterGlasses !== undefined && <small style={{ display: 'block', color: '#0288d1', marginTop: '2px', fontWeight: '500' }}>💧 Water: {habit.waterGlasses} / {savedLakasSettings.targets.water || 8} glasses</small>}
                  {habit.notes && <small>{habit.notes}</small>}
                </div>
                <button type="button" onClick={async () => { if (await confirmDeleteApp('this check-in')) await fsDel(user.uid, 'lakasHabits', habit._id) }}>Delete</button>
              </div>
            ))}
          </div>
        </section>
        )}

        {showBody && (
        <section className={lStyles.panel}>
          <div className={lStyles.sectionHeader}>
            <div>
              <div className={lStyles.sectionKicker}>Body</div>
              <h3>Body check-in</h3>
              <p className={lStyles.sectionHint}>Save measurements and notes; privacy mode still hides sensitive details. Trends are here to help you track change, not to diagnose you.</p>
            </div>
          </div>
          <div className={lStyles.formGrid}>
            <label>
              <span>Date</span>
              <div className={styles.dateFieldWrap}>
                <div className={styles.dateFieldDisplay}>
                  {formatDisplayDate(bodyForm.date)}
                </div>
                <input
                  type="date"
                  className={styles.dateFieldNative}
                  value={bodyForm.date}
                  onChange={event => setBodyForm(current => ({ ...current, date: event.target.value }))}
                />
              </div>
            </label>
            <label>
              <span>Weight ({savedLakasSettings.units.weight})</span>
              <input type="number" min="0" inputMode="decimal" value={bodyForm.weight} placeholder="70" onChange={event => setBodyForm(current => ({ ...current, weight: event.target.value }))} />
            </label>
            <label className={lStyles.full}>
              <span>Notes</span>
              <input value={bodyForm.notes} placeholder="Morning weigh-in, energy, or recovery note" onChange={event => setBodyForm(current => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <details className={lStyles.advancedBox}>
            <summary className={lStyles.advancedSummary}>
              <span>More measurements</span>
              <small>Height, waist, chest, hips, arm, and thigh</small>
            </summary>
            <div className={lStyles.advancedGrid}>
              <label>
                <span>Height ({savedLakasSettings.units.body})</span>
                <input type="number" min="0" inputMode="decimal" value={bodyForm.height} placeholder="170" onChange={event => setBodyForm(current => ({ ...current, height: event.target.value }))} />
              </label>
              <label>
                <span>Waist ({savedLakasSettings.units.body})</span>
                <input type="number" min="0" inputMode="decimal" value={bodyForm.waist} placeholder="82" onChange={event => setBodyForm(current => ({ ...current, waist: event.target.value }))} />
              </label>
              <label>
                <span>Chest ({savedLakasSettings.units.body})</span>
                <input type="number" min="0" inputMode="decimal" value={bodyForm.chest} placeholder="96" onChange={event => setBodyForm(current => ({ ...current, chest: event.target.value }))} />
              </label>
              <label>
                <span>Hips ({savedLakasSettings.units.body})</span>
                <input type="number" min="0" inputMode="decimal" value={bodyForm.hips} placeholder="94" onChange={event => setBodyForm(current => ({ ...current, hips: event.target.value }))} />
              </label>
              <label>
                <span>Arm ({savedLakasSettings.units.body})</span>
                <input type="number" min="0" inputMode="decimal" value={bodyForm.arm} placeholder="32" onChange={event => setBodyForm(current => ({ ...current, arm: event.target.value }))} />
              </label>
              <label>
                <span>Thigh ({savedLakasSettings.units.body})</span>
                <input type="number" min="0" inputMode="decimal" value={bodyForm.thigh} placeholder="54" onChange={event => setBodyForm(current => ({ ...current, thigh: event.target.value }))} />
              </label>
            </div>
          </details>
          <Button type="button" variant="primary" fullWidth onClick={handleAddBodyLog} disabled={savingBody}>
            {savingBody ? 'Saving body log...' : 'Save body log'}
          </Button>
          <div className={lStyles.inlineSection}>
            <div className={lStyles.inlineSectionHeader}>
              <strong>Recent body logs</strong>
              <span>Older archived images still stay hidden in privacy mode.</span>
            </div>
            {!bodyLogs.length ? <EmptyState compact>No body logs yet.</EmptyState> : visibleBodyLogs.map(log => {
              const bodyImage = bodyPhotoUrls[log._id] || log.photoUrl || ''
              return (
                <div key={log._id} className={lStyles.mealRow}>
                  {bodyImage && !hideBodyPhotos ? <img src={bodyImage} alt="" /> : <div className={lStyles.photoPlaceholder}>{bodyImage || log.photoPath ? 'Hidden' : 'Body'}</div>}
                  <div>
                    <strong>{formatDisplayDate(log.date)}</strong>
                    <span>{log.weight ? displayMetric(log.weight, savedLakasSettings.units.weight, privacyMode) : 'No weight'} · {log.waist ? displayMetric(log.waist, `${savedLakasSettings.units.body} waist`, privacyMode) : 'No waist'} · {!shouldShowBmi ? 'BMI hidden' : privacyMode && log.bmi ? 'BMI ...' : log.bmi ? `BMI ${formatNumber(log.bmi, 1)}` : 'No BMI'}</span>
                    <small>{privacyMode ? 'Private measurements' : ['chest', 'hips', 'arm', 'thigh'].map(key => log[key] ? `${key} ${formatNumber(log[key], 1)}${savedLakasSettings.units.body}` : '').filter(Boolean).join(' · ') || log.notes || 'No measurements'}</small>
                  </div>
                  <button type="button" onClick={async () => { if (await confirmDeleteApp('this body log')) await fsDeleteLakasBodyLog(user.uid, log) }}>Delete</button>
                </div>
              )
            })}
          </div>
        </section>
        )}

        {showGoals && (
        <section className={lStyles.panel}>
          <div className={lStyles.sectionHeader}>
            <div>
              <div className={lStyles.sectionKicker}>Goals</div>
              <h3>Goals</h3>
              <p className={lStyles.sectionHint}>Use measurable targets like workouts, steps, kg, protein, days, or your own unit. Keep them realistic and sustainable.</p>
            </div>
          </div>
          <div className={lStyles.formGrid}>
            <label>
              <span>Goal name</span>
              <input value={goalForm.name} placeholder="Lose 5kg, walk 8k daily" onChange={event => setGoalForm(current => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Type</span>
              <select value={goalForm.type} onChange={event => setGoalForm(current => ({ ...current, type: event.target.value }))}>
                {GOAL_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Current</span>
              <input type="number" min="0" inputMode="decimal" value={goalForm.current} placeholder="0" onChange={event => setGoalForm(current => ({ ...current, current: event.target.value }))} />
            </label>
            <label>
              <span>Target</span>
              <input type="number" min="0" inputMode="decimal" value={goalForm.target} placeholder="12" onChange={event => setGoalForm(current => ({ ...current, target: event.target.value }))} />
            </label>
            <label>
              <span>Unit</span>
              <input value={goalForm.unit} placeholder="kg, steps, sessions, days" onChange={event => setGoalForm(current => ({ ...current, unit: event.target.value }))} />
            </label>
          </div>
          <Button type="button" variant="primary" fullWidth onClick={handleAddGoal}>Save goal</Button>
          <div className={lStyles.inlineSection}>
            <div className={lStyles.inlineSectionHeader}>
              <strong>Tracked goals</strong>
              <span>Update progress in place without opening another screen.</span>
            </div>
            {!resolvedGoals.length ? <EmptyState compact>No goals yet.</EmptyState> : resolvedGoals.map(goal => {
              const target = numberOrZero(goal.target)
              const current = numberOrZero(goal.current)
              const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
              return (
                <div key={goal._id} className={lStyles.goalCard}>
                  <div className={lStyles.goalTop}>
                    <div>
                      <strong>{goal.name}</strong>
                      <span>{goal.type} · {displayMetric(current, goal.unit, privacyMode)} of {displayMetric(target, goal.unit, privacyMode)}</span>
                    </div>
                    <button type="button" onClick={async () => { if (await confirmDeleteApp(goal.name)) await fsDel(user.uid, 'lakasGoals', goal._id) }}>Delete</button>
                  </div>
                  <div className={lStyles.track}><div style={{ width: `${pct}%` }} /></div>
                  <div className={lStyles.goalUpdate}>
                    <input type="number" min="0" inputMode="decimal" placeholder={`Add ${goal.unit || 'progress'}`} value={goalProgress[goal._id] || ''} onChange={event => setGoalProgress(currentRows => ({ ...currentRows, [goal._id]: event.target.value }))} />
                    <button type="button" onClick={() => handleGoalProgress(goal)}>Add</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        )}
      </div>
      )}

      {showProgress && (
      <div className={lStyles.insightGrid}>
        <section className={`${lStyles.panel} ${lStyles.progressCoachPanel}`}>
          <div className={lStyles.sectionHeader}>
            <div>
              <div className={lStyles.sectionKicker}>Progress check-in</div>
              <h3>See the trend, then choose the next move.</h3>
              <p className={lStyles.sectionHint}>Use this page after the work is done: notice what is improving, then decide what Lakas should guide you toward next.</p>
            </div>
          </div>
          <div className={lStyles.progressCoachGrid}>
            <div className={lStyles.progressCoachSummary}>
              <span>Next recommended program</span>
              <strong>{featuredWorkoutSession.label}</strong>
              <p>{coachingSystem.progress.body}</p>
              <div className={lStyles.progressCoachNotes}>
                <small>{displayMetric(insights.workoutsThisWeek, 'workouts', privacyMode, 0)} this week · target {displayMetric(weeklyWorkoutTarget, 'workouts', privacyMode, 0)}</small>
                <small>{progressHighlightExercise ? `Main lift right now: ${progressHighlightExercise.name}` : 'Main lift appears after a few repeat sessions.'}</small>
              </div>
            </div>
            <div className={lStyles.progressCoachMetricGrid}>
              <div>
                <span>Consistency</span>
                <strong>{displayMetric(insights.records.workoutStreak, 'days', privacyMode, 0)}</strong>
                <small>Current streak</small>
              </div>
              <div>
                <span>This month</span>
                <strong>{displayMetric(currentMonthReport.workoutCount, 'workouts', privacyMode, 0)}</strong>
                <small>Saved workouts</small>
              </div>
              <div>
                <span>Main exercises</span>
                <strong>{displayMetric(exerciseInsights.mainExercises.length, '', privacyMode, 0)}</strong>
                <small>Tracked with history</small>
              </div>
            </div>
          </div>
          <div className={lStyles.analyticsFooter}>
            <span>
              {progressHistoryHighlight
                ? `${progressHistoryHighlight.name} has repeat history ready`
                : 'Repeat a few exercises to unlock clearer history signals'}
            </span>
            <small>
              {currentMonthReport.topExercise
                ? `This month’s busiest lift: ${currentMonthReport.topExercise.name}`
                : 'Monthly top exercise appears after a few logged sessions.'}
            </small>
          </div>
        </section>

        <section className={`${lStyles.panel} ${lStyles.progressWidePanel}`}>
          <div className={lStyles.sectionHeader}>
            <div>
              <div className={lStyles.sectionKicker}>Deeper review</div>
              <h3>Keep the first progress screen small. Open the rest only when you need it.</h3>
              <p className={lStyles.sectionHint}>The quick snapshot stays visible first. Records, charts, history, and calendar review now live in calmer expandable sections below.</p>
            </div>
          </div>
          <div className={lStyles.recordGrid}>
            {progressSnapshotCards.map(card => (
              <div key={card.label} className={lStyles.recordCard}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.meta}</small>
              </div>
            ))}
          </div>
          <div className={lStyles.progressReviewAccordion}>
            <details className={lStyles.advancedBox}>
              <summary className={lStyles.advancedSummary}>
                <span>7-day trends</span>
                <small>Weight, nutrition, and habit consistency over the past week</small>
              </summary>
              <div className={lStyles.progressReviewStack}>
                <div className={lStyles.chartGrid}>
                  <SvgSparkLine
                    title={`Weight trend (${savedLakasSettings.units.weight})`}
                    rows={insights.weightTrend}
                    unit={savedLakasSettings.units.weight}
                    hidden={privacyMode}
                    color="hsl(200 80% 55%)"
                  />
                  <MiniBarChart
                    title="Calories logged (kcal)"
                    rows={insights.caloriesByDay}
                    unit="kcal"
                    hidden={privacyMode}
                    color="hsl(25 90% 55%)"
                  />
                  <MiniBarChart
                    title="Protein logged (g)"
                    rows={insights.proteinByDay}
                    unit="g"
                    hidden={privacyMode}
                    color="hsl(155 70% 45%)"
                  />
                  <MiniBarChart
                    title="Workout volume"
                    rows={insights.volumeByDay}
                    unit={`${savedLakasSettings.units.weight} vol`}
                    hidden={privacyMode}
                    color="hsl(280 70% 60%)"
                  />
                  <MiniBarChart
                    title="Daily steps"
                    rows={insights.stepsByDay}
                    unit="steps"
                    hidden={privacyMode}
                    color="hsl(45 95% 55%)"
                  />
                  <HabitHeatmap
                    title="Habit check-ins (7 days)"
                    rows={insights.habitByDay}
                    hidden={privacyMode}
                  />
                </div>
              </div>
            </details>

            <details className={lStyles.advancedBox}>
              <summary className={lStyles.advancedSummary}>
                <span>Records and main exercises</span>
                <small>Personal bests, top lifts, and estimated strength</small>
              </summary>
              <div className={lStyles.progressReviewStack}>
                <section className={lStyles.progressReviewBlock}>
                  <div className={lStyles.progressReviewHeader}>
                    <strong>Personal records</strong>
                    <span>Review your current bests after logging, not before.</span>
                  </div>
                  <div className={lStyles.recordGrid}>
                    {[
                      ['Best lift', insights.records.bestLift],
                      ['Most reps', insights.records.mostReps],
                      ['Best volume', insights.records.highestVolume],
                      ['Longest workout', insights.records.longestWorkout],
                      ['Longest cardio', insights.records.longestCardio],
                      ['Workout streak', { label: 'Current', value: insights.records.workoutStreak, unit: 'days' }],
                    ].map(([label, record]) => {
                      const recordUnit = record?.unit === 'kg'
                        ? savedLakasSettings.units.weight
                        : record?.unit === 'kg volume'
                          ? `${savedLakasSettings.units.weight} volume`
                          : record?.unit
                      return (
                        <div key={label} className={lStyles.recordCard}>
                          <span>{label}</span>
                          <strong>{record ? displayMetric(record.value, recordUnit, privacyMode) : 'No record'}</strong>
                          <small>{record?.label || 'Log more to unlock'}</small>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section className={lStyles.progressReviewBlock}>
                  <div className={lStyles.progressReviewHeader}>
                    <strong>Main exercises</strong>
                    <span>Top exercises stay grouped with estimated 1RM, best load, and set count so you can see where the work is really landing.</span>
                  </div>
                  {!exerciseInsights.mainExercises.length ? (
                    <EmptyState compact>Log more workouts to unlock main exercise tracking.</EmptyState>
                  ) : (
                    <div className={lStyles.exerciseSummaryGrid}>
                      {exerciseInsights.mainExercises.slice(0, 4).map(exercise => (
                        <article key={exercise.key} className={lStyles.exerciseSummaryCard}>
                          <div className={lStyles.exerciseSummaryHead}>
                            <div>
                              <strong>{exercise.name}</strong>
                              <span>{exercise.category} · {exercise.primaryMuscle}</span>
                            </div>
                            <small>{displayMetric(exercise.sessionCount, 'sessions', privacyMode, 0)}</small>
                          </div>
                          <div className={lStyles.exerciseSummaryMeta}>
                            <span>Best load {exercise.bestWeight ? displayMetric(exercise.bestWeight, savedLakasSettings.units.weight, privacyMode) : 'No load yet'}</span>
                            <span>Est 1RM {exercise.bestOneRm ? displayMetric(exercise.bestOneRm, savedLakasSettings.units.weight, privacyMode) : 'No estimate yet'}</span>
                            <span>{displayMetric(exercise.totalSets, 'sets', privacyMode, 0)} · {displayMetric(exercise.totalVolume, `${savedLakasSettings.units.weight} volume`, privacyMode, 0)}</span>
                          </div>
                          <small>{exercise.lastDate ? `Last logged ${formatDisplayDate(exercise.lastDate)} in ${exercise.lastWorkoutTitle}` : 'No saved history yet'}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </details>

            <details className={lStyles.advancedBox}>
              <summary className={lStyles.advancedSummary}>
                <span>Weekly charts</span>
                <small>Frequency, volume, steps, and weight trend</small>
              </summary>
              <div className={lStyles.progressReviewStack}>
                <div className={lStyles.chartGrid}>
                  <MiniBarChart title="Workout frequency" rows={insights.workoutFrequency} unit="workouts" hidden={privacyMode} />
                  <MiniBarChart title="Volume lifted" rows={insights.volumeByDay} unit={savedLakasSettings.units.weight} hidden={privacyMode} />
                  <MiniBarChart title="Steps" rows={insights.stepsByDay} unit="steps" hidden={privacyMode} />
                  <MiniBarChart title="Weight trend" rows={insights.weightTrend.length ? insights.weightTrend : [{ key: 'empty', label: '--', value: 0 }]} unit={savedLakasSettings.units.weight} hidden={privacyMode} />
                </div>
              </div>
            </details>

            <details className={lStyles.advancedBox}>
              <summary className={lStyles.advancedSummary}>
                <span>Exercise history and muscle balance</span>
                <small>Progression charts and set distribution</small>
              </summary>
              <div className={lStyles.progressReviewStack}>
                <section className={lStyles.progressReviewBlock}>
                  <div className={lStyles.progressReviewHeader}>
                    <strong>Recent exercise trends</strong>
                    <span>Follow repeated lifts across recent sessions.</span>
                  </div>
                  {!exerciseInsights.historyCharts.length ? (
                    <EmptyState compact>Repeat a few exercises more than once to unlock their history charts.</EmptyState>
                  ) : (
                    <div className={lStyles.chartGrid}>
                      {exerciseInsights.historyCharts.map(chart => (
                        <MiniBarChart
                          key={chart.key}
                          title={`${chart.name} · ${chart.metric}`}
                          rows={chart.rows}
                          unit={chart.metric === 'Estimated 1RM' ? savedLakasSettings.units.weight : chart.metric === 'Volume' ? `${savedLakasSettings.units.weight} volume` : 'sets'}
                          hidden={privacyMode}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section className={lStyles.progressReviewBlock}>
                  <div className={lStyles.progressReviewHeader}>
                    <strong>Set count by muscle group</strong>
                    <span>These totals come from your exercise library mapping.</span>
                  </div>
                  {!exerciseInsights.muscleDistribution.length ? (
                    <EmptyState compact>Map a few exercises in the library to see muscle-group totals here.</EmptyState>
                  ) : (
                    <div className={lStyles.muscleGrid}>
                      {exerciseInsights.muscleDistribution.slice(0, 6).map(muscle => (
                        <div key={muscle.label} className={lStyles.muscleRow}>
                          <div className={lStyles.muscleRowTop}>
                            <strong>{muscle.label}</strong>
                            <span>{displayMetric(muscle.value, 'sets', privacyMode, 1)}</span>
                          </div>
                          <div className={lStyles.track}>
                            <div style={{ width: `${(muscle.value / Math.max(1, exerciseInsights.muscleDistribution[0]?.value || 1)) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </details>

            <details className={lStyles.advancedBox}>
              <summary className={lStyles.advancedSummary}>
                <span>Calendar, month, and year</span>
                <small>Training rhythm, monthly rollup, and year review</small>
              </summary>
              <div className={lStyles.progressReviewStack}>
                <section className={lStyles.progressReviewBlock}>
                  <div className={lStyles.progressReviewHeader}>
                    <strong>Training calendar</strong>
                    <span>Dots show the days with workouts, activity, body logs, or habit check-ins.</span>
                  </div>
                  <div className={lStyles.monthControls}>
                    <button type="button" onClick={() => setCalendarMonth(current => addMonths(current, -1))}>Prev</button>
                    <strong>{calendarMonth}</strong>
                    <button type="button" onClick={() => setCalendarMonth(current => addMonths(current, 1))}>Next</button>
                  </div>
                  <div className={lStyles.calendarGrid}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <div key={`${label}-${index}`} className={lStyles.calendarHead}>{label}</div>)}
                    {calendarData.map(day => (
                      <div key={day.key} className={`${lStyles.calendarDay} ${day.empty ? lStyles.calendarEmpty : ''} ${day.key === today() ? lStyles.calendarToday : ''}`}>
                        {!day.empty && (
                          <>
                            <strong>{day.day}</strong>
                            <div className={lStyles.calendarDots}>
                              {!!day.workouts.length && <span title="Workout" className={lStyles.dotWorkout} />}
                              {!!day.activities.length && <span title="Activity" className={lStyles.dotActivity} />}
                              {!!day.bodies.length && <span title="Body log" className={lStyles.dotBody} />}
                              {!!day.habits.length && <span title="Habit" className={lStyles.dotHabit} />}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={lStyles.legendRow}>
                    <span><i className={lStyles.dotWorkout} /> Workout</span>
                    <span><i className={lStyles.dotActivity} /> Activity</span>
                    <span><i className={lStyles.dotBody} /> Body</span>
                    <span><i className={lStyles.dotHabit} /> Habit</span>
                  </div>
                </section>

                <section className={lStyles.progressReviewBlock}>
                  <div className={lStyles.progressReviewHeader}>
                    <strong>{currentMonthReport.label}</strong>
                    <span>Monthly rollup of workouts, volume, movement, and body check-ins.</span>
                  </div>
                  <div className={lStyles.recordGrid}>
                    {[
                      ['Workouts', { value: currentMonthReport.workoutCount, unit: '' }, 'Logged this month'],
                      ['Volume', { value: currentMonthReport.workoutVolume, unit: `${savedLakasSettings.units.weight} volume` }, 'Lifted this month'],
                      ['Active days', { value: currentMonthReport.activeDays, unit: '' }, 'Days with training or movement'],
                      ['Body check-ins', { value: currentMonthReport.bodyCheckIns, unit: '' }, 'Saved this month'],
                    ].map(([label, metric, meta]) => (
                      <div key={label} className={lStyles.recordCard}>
                        <span>{label}</span>
                        <strong>{displayMetric(metric.value, metric.unit, privacyMode, 0)}</strong>
                        <small>{meta}</small>
                      </div>
                    ))}
                  </div>
                  <div className={lStyles.analyticsFooter}>
                    <span>{displayMetric(currentMonthReport.activeMinutes, 'active min', privacyMode, 0)} · {displayMetric(currentMonthReport.steps, 'steps', privacyMode, 0)}</span>
                    <small>{currentMonthReport.topExercise ? `Top exercise: ${currentMonthReport.topExercise.name}` : 'Top exercise appears after a few logged sessions.'}</small>
                  </div>
                </section>

                <section className={lStyles.progressReviewBlock}>
                  <div className={lStyles.progressReviewHeader}>
                    <strong>{yearInReview.yearKey}</strong>
                    <span>Annual roll-up of how much you trained and where the momentum was strongest.</span>
                  </div>
                  <div className={lStyles.yearReviewHero}>
                    <div>
                      <span>Training volume</span>
                      <strong>{displayMetric(yearInReview.workoutVolume, `${savedLakasSettings.units.weight} volume`, privacyMode, 0)}</strong>
                      <small>{displayMetric(yearInReview.workoutCount, 'workouts', privacyMode, 0)} · {displayMetric(yearInReview.activeDays, 'active days', privacyMode, 0)}</small>
                    </div>
                    <div className={lStyles.yearReviewMeta}>
                      <span>{yearInReview.topExercise ? `Top exercise: ${yearInReview.topExercise.name}` : 'Top exercise unlocks after more training.'}</span>
                      <span>{yearInReview.strongestExercise ? `Strongest estimate: ${yearInReview.strongestExercise.name}` : 'Estimated 1RM appears after weighted sets.'}</span>
                      <span>{yearInReview.bestMonth ? `Best month: ${yearInReview.bestMonth.label}` : 'Best month appears after more history.'}</span>
                    </div>
                  </div>
                  <div className={lStyles.recordGrid}>
                    {[
                      ['Active minutes', { value: yearInReview.activeMinutes, unit: 'min' }, 'Movement logged this year'],
                      ['Steps', { value: yearInReview.steps, unit: '' }, 'Tracked this year'],
                      ['Body check-ins', { value: yearInReview.bodyCheckIns, unit: '' }, 'Saved this year'],
                      ['Best month', { value: yearInReview.bestMonth?.workoutCount || 0, unit: 'workouts' }, yearInReview.bestMonth?.label || 'Waiting for more history'],
                    ].map(([label, metric, meta]) => (
                      <div key={label} className={lStyles.recordCard}>
                        <span>{label}</span>
                        <strong>{displayMetric(metric.value, metric.unit, privacyMode, 0)}</strong>
                        <small>{meta}</small>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </details>
          </div>
        </section>
      </div>
      )}

      {showSettings && (
      <div className={lStyles.settingsWorkspace}>
        <div className={lStyles.settingsColumn}>
          <section className={lStyles.panel}>
            <div className={lStyles.sectionHeader}>
              <div>
                <div className={lStyles.sectionKicker}>Basics</div>
                <h3>Core preferences</h3>
                <p className={lStyles.sectionHint}>Start with the defaults you notice most: units, BMI, and privacy.</p>
              </div>
            </div>
            <div className={lStyles.formGrid}>
              <label>
                <span>Weight</span>
                <select value={settingsForm.units.weight} onChange={event => updateSettingGroup('units', 'weight', event.target.value)}>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="lb">Pounds (lb)</option>
                </select>
              </label>
              <label>
                <span>Body measurements</span>
                <select value={settingsForm.units.body} onChange={event => updateSettingGroup('units', 'body', event.target.value)}>
                  <option value="cm">Centimeters (cm)</option>
                  <option value="in">Inches (in)</option>
                </select>
              </label>
              <label>
                <span>Distance</span>
                <select value={settingsForm.units.distance} onChange={event => updateSettingGroup('units', 'distance', event.target.value)}>
                  <option value="km">Kilometers (km)</option>
                  <option value="mi">Miles (mi)</option>
                </select>
              </label>
              <label>
                <span>Show BMI</span>
                <select value={settingsForm.display.showBmi ? 'yes' : 'no'} onChange={event => updateSettingGroup('display', 'showBmi', event.target.value === 'yes')}>
                  <option value="yes">Show BMI</option>
                  <option value="no">Hide BMI</option>
                </select>
              </label>
            </div>
            <div className={lStyles.settingsSaveNotice}>
              <div>
                <strong>Pending changes</strong>
                <span>Changes below stay pending until you save.</span>
              </div>
              <Button type="button" variant="primary" fullWidth onClick={handleSaveLakasSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Lakas settings'}
              </Button>
            </div>
          </section>

          <section className={lStyles.panel}>
            <div className={lStyles.sectionHeader}>
              <div>
                <div className={lStyles.sectionKicker}>Everyday defaults</div>
                <h3>Targets, nutrition, and reminders</h3>
                <p className={lStyles.sectionHint}>These are the defaults you feel during the week. Keep them close, and open the details only when you want to change them.</p>
              </div>
            </div>
            <div className={lStyles.settingsStack}>
              <details className={lStyles.advancedBox}>
                <summary className={lStyles.advancedSummary}>
                  <span>Daily targets</span>
                  <small>Steps, sleep, water, workouts</small>
                </summary>
                <div className={lStyles.advancedGrid}>
                  <label>
                    <span>Steps</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.targets.steps} onChange={event => updateSettingGroup('targets', 'steps', event.target.value)} />
                  </label>
                  <label>
                    <span>Calories</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.targets.calories} onChange={event => updateSettingGroup('targets', 'calories', event.target.value)} />
                  </label>
                  <label>
                    <span>Protein (g)</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.targets.protein} onChange={event => updateSettingGroup('targets', 'protein', event.target.value)} />
                  </label>
                  <label>
                    <span>Water glasses</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.targets.water} onChange={event => updateSettingGroup('targets', 'water', event.target.value)} />
                  </label>
                  <label>
                    <span>Sleep hours</span>
                    <input type="number" min="0" inputMode="decimal" value={settingsForm.targets.sleep} onChange={event => updateSettingGroup('targets', 'sleep', event.target.value)} />
                  </label>
                  <label>
                    <span>Workouts/week</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.targets.workoutsPerWeek} onChange={event => updateSettingGroup('targets', 'workoutsPerWeek', event.target.value)} />
                  </label>
                </div>
              </details>

              <details className={lStyles.advancedBox}>
                <summary className={lStyles.advancedSummary}>
                  <span>Nutrition and reminder defaults</span>
                  <small>Meal goals and the timing you return to most</small>
                </summary>
                <div className={lStyles.advancedGrid}>
                  <label>
                    <span>Calorie goal</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.meals.calorieGoal} onChange={event => updateSettingGroup('meals', 'calorieGoal', event.target.value)} />
                  </label>
                  <label>
                    <span>Protein goal</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.meals.proteinGoal} onChange={event => updateSettingGroup('meals', 'proteinGoal', event.target.value)} />
                  </label>
                  <label>
                    <span>Macro style</span>
                    <select value={settingsForm.meals.macroStyle} onChange={event => updateSettingGroup('meals', 'macroStyle', event.target.value)}>
                      <option>Balanced</option>
                      <option>High protein</option>
                      <option>Recomp</option>
                      <option>Cutting</option>
                      <option>Bulking</option>
                    </select>
                  </label>
                  <label>
                    <span>Workout time</span>
                    <input type="time" value={settingsForm.reminders.workoutTime} onChange={event => updateSettingGroup('reminders', 'workoutTime', event.target.value)} />
                  </label>
                  <label>
                    <span>Weigh-in day</span>
                    <select value={settingsForm.reminders.weighInDay} onChange={event => updateSettingGroup('reminders', 'weighInDay', event.target.value)}>
                      {WEEK_DAYS.map(day => <option key={day}>{day}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Reminder repeat</span>
                    <select value={settingsForm.reminders.frequency} onChange={event => updateSettingGroup('reminders', 'frequency', event.target.value)}>
                      {REMINDER_FREQUENCIES.map(freq => <option key={freq}>{freq}</option>)}
                    </select>
                  </label>
                </div>
              </details>

              <details className={lStyles.advancedBox}>
                <summary className={lStyles.advancedSummary}>
                  <span>Reminders</span>
                  <small>Workouts, walks, weigh-ins, and habits</small>
                </summary>
                <div className={lStyles.advancedGrid}>
                  <label>
                    <span>Reminder</span>
                    <input value={reminderForm.title} placeholder="Workout, weigh-in, walk" onChange={event => setReminderForm(current => ({ ...current, title: event.target.value }))} />
                  </label>
                  <label>
                    <span>Type</span>
                    <select value={reminderForm.type} onChange={event => setReminderForm(current => ({ ...current, type: event.target.value }))}>
                      {REMINDER_TYPES.map(type => <option key={type}>{type}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Date</span>
                    <div className={styles.dateFieldWrap}>
                      <div className={styles.dateFieldDisplay}>
                        {formatDisplayDate(reminderForm.date)}
                      </div>
                      <input
                        type="date"
                        className={styles.dateFieldNative}
                        value={reminderForm.date}
                        onChange={event => setReminderForm(current => ({ ...current, date: event.target.value }))}
                      />
                    </div>
                  </label>
                  <label>
                    <span>Time</span>
                    <input type="time" value={reminderForm.time} onChange={event => setReminderForm(current => ({ ...current, time: event.target.value }))} />
                  </label>
                  <label>
                    <span>Repeat</span>
                    <select value={reminderForm.frequency} onChange={event => setReminderForm(current => ({ ...current, frequency: event.target.value }))}>
                      {REMINDER_FREQUENCIES.map(freq => <option key={freq}>{freq}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Notes</span>
                    <input value={reminderForm.notes} placeholder="Optional reminder note" onChange={event => setReminderForm(current => ({ ...current, notes: event.target.value }))} />
                  </label>
                </div>
                <div className={lStyles.inlineSection}>
                  <Button type="button" variant="primary" fullWidth onClick={handleAddReminder}>Save reminder</Button>
                  <div className={lStyles.routineList}>
                    {!upcomingReminders.length ? <EmptyState compact>No reminders yet.</EmptyState> : upcomingReminders.map(reminder => (
                      <div key={reminder._id} className={lStyles.routineCard}>
                        <div>
                          <strong>{reminder.title}</strong>
                          <span>{reminder.type} · {formatDisplayDate(reminder.date)} {reminder.time || ''} · {reminder.frequency}</span>
                          {reminder.notes && <small>{reminder.notes}</small>}
                        </div>
                        <div className={lStyles.routineActions}>
                          <button type="button" onClick={() => fsUpdate(user.uid, 'lakasReminders', reminder._id, { enabled: reminder.enabled === false })}>
                            {reminder.enabled === false ? 'Enable' : 'Pause'}
                          </button>
                          <button type="button" onClick={async () => { if (await confirmDeleteApp(reminder.title)) await fsDel(user.uid, 'lakasReminders', reminder._id) }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </section>
        </div>

        <div className={lStyles.settingsColumn}>
          <section className={`${lStyles.panel} ${lStyles.settingsSecondaryPanel}`}>
            <div className={lStyles.sectionHeader}>
              <div>
                <div className={lStyles.sectionKicker}>More setup</div>
                <h3>Workout defaults and exercise data</h3>
                <p className={lStyles.sectionHint}>These are useful, but they do not need to crowd the basics. Open them only when you want to fine-tune how Lakas starts and tracks training.</p>
              </div>
            </div>
            <div className={lStyles.settingsStack}>
              <details className={lStyles.advancedBox}>
                <summary className={lStyles.advancedSummary}>
                  <span>Training profile and workout defaults</span>
                  <small>Experience, goals, equipment, sets, and reps</small>
                </summary>
                <div className={lStyles.formGrid} style={{ padding: '0 12px 12px' }}>
                  <label>
                    <span>Experience level</span>
                    <select value={settingsForm.training.experienceLevel} onChange={event => updateSettingGroup('training', 'experienceLevel', event.target.value)}>
                      <option>Beginner</option>
                      <option>Returning</option>
                      <option>Intermediate</option>
                    </select>
                  </label>
                  <label>
                    <span>Progression mode</span>
                    <select value={settingsForm.training.progressionMode} onChange={event => updateSettingGroup('training', 'progressionMode', event.target.value)}>
                      <option>Guided</option>
                      <option>Flexible</option>
                    </select>
                  </label>
                  <label>
                    <span>Primary goal</span>
                    <select value={settingsForm.baseline.goal} onChange={event => updateSettingGroup('baseline', 'goal', event.target.value)}>
                      <option>Build consistency</option>
                      <option>Recomp</option>
                      <option>Lose weight</option>
                      <option>Gain muscle</option>
                      <option>Get stronger</option>
                      <option>Move more</option>
                    </select>
                  </label>
                  <label>
                    <span>Workout place</span>
                    <select value={settingsForm.baseline.workoutPlace} onChange={event => updateSettingGroup('baseline', 'workoutPlace', event.target.value)}>
                      <option>Gym</option>
                      <option>Home</option>
                      <option>Both</option>
                    </select>
                  </label>
                  <label>
                    <span>Equipment</span>
                    <select value={settingsForm.baseline.equipment} onChange={event => updateSettingGroup('baseline', 'equipment', event.target.value)}>
                      <option>None</option>
                      <option>Dumbbells</option>
                      <option>Machines</option>
                      <option>Full gym</option>
                    </select>
                  </label>
                  <label className={lStyles.full}>
                    <span>Limitations or comfort notes</span>
                    <input value={settingsForm.baseline.limitations} placeholder="Optional. Keep starter programs gentler." onChange={event => updateSettingGroup('baseline', 'limitations', event.target.value)} />
                  </label>
                  <label>
                    <span>Sets</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.workoutDefaults.sets} onChange={event => updateSettingGroup('workoutDefaults', 'sets', event.target.value)} />
                  </label>
                  <label>
                    <span>Reps</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.workoutDefaults.reps} onChange={event => updateSettingGroup('workoutDefaults', 'reps', event.target.value)} />
                  </label>
                  <label>
                    <span>Rest seconds</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.workoutDefaults.restSeconds} onChange={event => updateSettingGroup('workoutDefaults', 'restSeconds', event.target.value)} />
                  </label>
                  <label>
                    <span>Default duration (min)</span>
                    <input type="number" min="0" inputMode="numeric" value={settingsForm.workoutDefaults.durationMinutes} onChange={event => updateSettingGroup('workoutDefaults', 'durationMinutes', event.target.value)} />
                  </label>
                </div>
              </details>

              <details className={lStyles.advancedBox}>
                <summary className={lStyles.advancedSummary}>
                  <span>Exercise library</span>
                  <small>Custom names, categories, and muscle mapping</small>
                </summary>
                <div style={{ padding: '0 12px 12px' }}>
                  <div className={lStyles.exerciseLibrarySummary}>
                    <span>{DEFAULT_EXERCISE_LIBRARY.length} starter exercises ready</span>
                    <span>{pendingExerciseCount} custom {pendingExerciseCount === 1 ? 'entry' : 'entries'} pending in settings</span>
                  </div>
                  <div className={lStyles.formGrid}>
                    <label>
                      <span>Exercise name</span>
                      <input
                        list="lakas-exercise-library"
                        value={exerciseLibraryDraft.name}
                        placeholder="Cable fly, Bulgarian split squat"
                        onChange={event => setExerciseLibraryDraft(current => ({ ...current, name: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Category</span>
                      <select value={exerciseLibraryDraft.category} onChange={event => setExerciseLibraryDraft(current => ({ ...current, category: event.target.value }))}>
                        {EXERCISE_LIBRARY_CATEGORIES.map(category => <option key={category}>{category}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Primary muscle</span>
                      <select value={exerciseLibraryDraft.primaryMuscle} onChange={event => setExerciseLibraryDraft(current => ({ ...current, primaryMuscle: event.target.value }))}>
                        {EXERCISE_MUSCLE_GROUPS.map(muscle => <option key={muscle}>{muscle}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Secondary muscles</span>
                      <input
                        value={exerciseLibraryDraft.secondaryMuscles}
                        placeholder="Glutes, Core"
                        onChange={event => setExerciseLibraryDraft(current => ({ ...current, secondaryMuscles: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className={lStyles.libraryFormActions}>
                    <Button type="button" variant="primary" fullWidth onClick={handleQueueExerciseLibraryEntry}>
                      {pendingCustomExercises.some(entry => normalizeExerciseKey(entry.name) === normalizeExerciseKey(exerciseLibraryDraft.name))
                        ? 'Update pending exercise'
                        : 'Add to pending library'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setExerciseLibraryDraft(createExerciseLibraryDraft())}>
                      Clear
                    </Button>
                  </div>
                  <div className={lStyles.inlineSection}>
                    <div className={lStyles.inlineSectionHeader}>
                      <strong>Pending custom exercises</strong>
                      <span>These stay local to your pending settings until you save Lakas settings.</span>
                    </div>
                    {!pendingCustomExercises.length ? (
                      <EmptyState compact>No custom exercises yet. The starter library still powers suggestions and analytics.</EmptyState>
                    ) : (
                      <div className={lStyles.customExerciseList}>
                        {pendingCustomExercises.map(entry => (
                          <div key={entry.name} className={lStyles.rowCard}>
                            <div>
                              <strong>{entry.name}</strong>
                              <span>{entry.category} · {entry.primaryMuscle}</span>
                              <small>{normalizeExerciseSecondaryMuscles(entry.secondaryMuscles).length ? normalizeExerciseSecondaryMuscles(entry.secondaryMuscles).join(' · ') : 'No secondary muscles listed'}</small>
                            </div>
                            <div className={lStyles.rowActions}>
                              <button type="button" onClick={() => handleEditExerciseLibraryEntry(entry)}>Edit</button>
                              <button type="button" onClick={() => handleRemoveExerciseLibraryEntry(entry.name)}>Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          </section>

          <section className={lStyles.panel}>
            <div className={lStyles.sectionHeader}>
              <div>
                <div className={lStyles.sectionKicker}>Account tools</div>
                <h3>Privacy, backup, and logout</h3>
                <p className={lStyles.sectionHint}>These stay tucked away on purpose, so the rest of Lakas can stay focused on training and everyday logging.</p>
              </div>
            </div>
            <div className={lStyles.settingsStack}>
              <details className={lStyles.advancedBox}>
                <summary className={lStyles.advancedSummary}>
                  <span>Older saved media visibility</span>
                  <small>Privacy mode for older entries</small>
                </summary>
                <div className={lStyles.advancedGrid}>
                  <label className={lStyles.full}>
                    <span>Older saved media in privacy mode</span>
                    <select value={settingsForm.display.hideProgressPhotosInPrivacy ? 'hide' : 'show'} onChange={event => updateSettingGroup('display', 'hideProgressPhotosInPrivacy', event.target.value === 'hide')}>
                      <option value="hide">Hide older saved media</option>
                      <option value="show">Show older saved media</option>
                    </select>
                  </label>
                </div>
              </details>

              <details className={lStyles.advancedBox}>
                <summary className={lStyles.advancedSummary}>
                  <span>Export or clear Lakas data</span>
                  <small>Backup or delete fitness logs</small>
                </summary>
                <div className={lStyles.inlineSection}>
                  <div className={lStyles.settingsActions}>
                    <Button type="button" variant="secondary" onClick={handleExportLakasData} fullWidth>
                      Export Lakas data
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleDeleteLakasData} fullWidth disabled={deletingLakasData}>
                      {deletingLakasData ? 'Deleting...' : 'Delete Lakas logs'}
                    </Button>
                  </div>
                  <EmptyState compact>
                    Your Lakas settings stay. Older saved media tied to older entries is removed too.
                  </EmptyState>
                </div>
              </details>

              <details className={lStyles.advancedBox}>
                <summary className={lStyles.advancedSummary}>
                  <span>Log out from this device</span>
                  <small>Leave Buhay safely from Lakas</small>
                </summary>
                <div className={lStyles.inlineSection}>
                  <Button type="button" variant="ghost" onClick={handleLogout} fullWidth>
                    Log out
                  </Button>
                </div>
              </details>
            </div>
          </section>
        </div>
      </div>
      )}

      {gymSessionOverlay && typeof document !== 'undefined' ? createPortal(gymSessionOverlay, document.body) : null}
    </div>
  )
}
