// floorTier: 'early' (floors 0-1), 'mid' (floors 2-3), 'late' (floors 4-5), 'any' (all floors equally)
export const ENEMIES = {
  // ACT 1
  yarn_golem: {
    id: 'yarn_golem', name: 'Yarn Golem', hp: 38, maxHp: 38, block: 0, statuses: {},
    act: 1, elite: false, floorTier: 'late',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:8,desc:'Tangles you for 8'},
      {type:'block',value:10,desc:'Winds up (block 10)'},
      {type:'attack',value:12,desc:'Unravels for 12'}
    ]
  },
  laser_sprite: {
    id: 'laser_sprite', name: 'Laser Sprite', hp: 28, maxHp: 28, block: 0, statuses: {},
    act: 1, elite: false, floorTier: 'mid',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:6,desc:'Zips for 6'},
      {type:'attack',value:6,desc:'Zips for 6'},
      {type:'buff',status:'strong',value:2,desc:'Charges up'}
    ]
  },
  moth_swarm: {
    id: 'moth_swarm', name: 'Moth Swarm', hp: 24, maxHp: 24, block: 0, statuses: {},
    act: 1, elite: false, floorTier: 'early',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:5,desc:'Flutters for 5'},
      {type:'attack',value:5,desc:'Flutters for 5'},
      {type:'attack',value:10,desc:'Swarms for 10'}
    ]
  },
  curtain_phantom: {
    id: 'curtain_phantom', name: 'Curtain Phantom', hp: 55, maxHp: 55, block: 0, statuses: {},
    act: 1, elite: true,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:14,desc:'Wraps for 14'},
      {type:'block',value:15,desc:'Hides in folds (block 15)'},
      {type:'attack',value:18,desc:'Suffocates for 18'},
      {type:'buff',status:'vulnerable',value:2,desc:'Exposes weakness'}
    ],
    thresholdBehavior: {
      below: 0.5,
      pattern: [
        {type:'attack',value:22,desc:'Desperate grasp for 22'},
        {type:'buff',status:'vulnerable',value:3,desc:'Exposes deep weakness'},
        {type:'attack',value:26,desc:'Smothers for 26'}
      ]
    }
  },
  // ACT 2
  guard_dog: {
    id: 'guard_dog', name: 'Guard Dog', hp: 70, maxHp: 70, block: 0, statuses: {},
    act: 2, elite: false, floorTier: 'late',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:12,desc:'Barks for 12'},
      {type:'block',value:12,desc:'Guards (block 12)'},
      {type:'attack',value:16,desc:'Bites for 16'}
    ]
  },
  vacuum_cleaner: {
    id: 'vacuum_cleaner', name: 'Vacuum Cleaner', hp: 65, maxHp: 65, block: 0, statuses: {},
    act: 2, elite: false, floorTier: 'mid',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:10,desc:'Sucks for 10'},
      {type:'attack',value:10,desc:'Sucks for 10'},
      {type:'buff',status:'strong',value:3,desc:'Powers up'}
    ]
  },
  squirrel: {
    id: 'squirrel', name: 'Squirrel', hp: 55, maxHp: 55, block: 0, statuses: {},
    act: 2, elite: false, floorTier: 'early',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:8,desc:'Scratches for 8'},
      {type:'attack',value:8,desc:'Scratches for 8'},
      {type:'attack',value:15,desc:'Acorn barrage for 15'}
    ]
  },
  golden_retriever: {
    id: 'golden_retriever', name: 'Golden Retriever', hp: 90, maxHp: 90, block: 0, statuses: {},
    act: 2, elite: true,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:18,desc:'Jumps for 18'},
      {type:'block',value:18,desc:'Sits (block 18)'},
      {type:'attack',value:22,desc:'Fetch tackle for 22'},
      {type:'buff',status:'strong',value:3,desc:'Fetches strength'}
    ],
    thresholdBehavior: {
      below: 0.5,
      pattern: [
        {type:'buff',status:'strong',value:4,desc:'Goes berserk (+4 str)'},
        {type:'attack',value:26,desc:'Frenzy bite for 26'},
        {type:'attack',value:26,desc:'Frenzy bite for 26'}
      ]
    }
  },
  raccoon: {
    id: 'raccoon', name: 'Raccoon', hp: 100, maxHp: 100, block: 0, statuses: {},
    act: 2, elite: true,
    emoji: '🦝',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:14,desc:'Scratches for 14'},
      {type:'buff',status:'vulnerable',value:2,desc:'Rummages through trash (2 vuln)'},
      {type:'block',value:16,desc:'Hides in bin (block 16)'},
      {type:'attack',value:20,desc:'Ambush bite for 20'}
    ],
    thresholdBehavior: {
      below: 0.5,
      pattern: [
        {type:'buff',status:'vulnerable',value:3,desc:'Panicked thrashing (3 vuln)'},
        {type:'attack',value:18,desc:'Desperation claw for 18'},
        {type:'attack',value:18,desc:'Desperation claw for 18'},
        {type:'buff',status:'strong',value:3,desc:'Cornered fury (+3 str)'}
      ]
    }
  },
  // ACT 3
  alley_cat: {
    id: 'alley_cat', name: 'Alley Cat', hp: 80, maxHp: 80, block: 0, statuses: {},
    act: 3, elite: false, floorTier: 'mid',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:14,desc:'Street swipes for 14'},
      {type:'attack',value:14,desc:'Street swipes for 14'},
      {type:'block',value:15,desc:'Dodges (block 15)'}
    ]
  },
  robot_cat: {
    id: 'robot_cat', name: 'Robot Cat', hp: 85, maxHp: 85, block: 0, statuses: {},
    act: 3, elite: false, floorTier: 'late',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:16,desc:'Laser eyes for 16'},
      {type:'buff',status:'strong',value:3,desc:'Overclocks'},
      {type:'attack',value:20,desc:'Rocket paws for 20'}
    ]
  },
  feral_pigeon: {
    id: 'feral_pigeon', name: 'Feral Pigeon', hp: 75, maxHp: 75, block: 0, statuses: {},
    act: 3, elite: false, floorTier: 'early',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:12,desc:'Pecks for 12'},
      {type:'attack',value:12,desc:'Pecks for 12'},
      {type:'attack',value:18,desc:'Dive bombs for 18'}
    ]
  },
  doberman: {
    id: 'doberman', name: 'Doberman', hp: 110, maxHp: 110, block: 0, statuses: {},
    act: 3, elite: true,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:22,desc:'Charges for 22'},
      {type:'block',value:20,desc:'Guards (block 20)'},
      {type:'attack',value:28,desc:'Mauls for 28'},
      {type:'buff',status:'strong',value:4,desc:'Goes berserk'}
    ],
    thresholdBehavior: {
      below: 0.5,
      pattern: [
        {type:'buff',status:'strong',value:5,desc:'Primal fury (+5 str)'},
        {type:'attack',value:34,desc:'Savage mauling for 34'},
        {type:'attack',value:34,desc:'Savage mauling for 34'},
        {type:'buff',status:'vulnerable',value:2,desc:'Crushes defenses'}
      ]
    }
  },
  // BOSSES
  the_dog: {
    id: 'the_dog', name: 'The Dog', hp: 160, maxHp: 160, block: 0, statuses: {},
    act: 1, elite: false, boss: true,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:15,desc:'Paw swipe for 15'},
      {type:'block',value:15,desc:'Sits and waits (block 15)'},
      {type:'attack',value:20,desc:'Howls for 20'},
      {type:'buff',status:'strong',value:3,desc:'Goes alpha (+3 str)'},
      {type:'attack',value:25,desc:'Alpha bite for 25'}
    ],
    thresholdBehavior: {
      below: 0.5,
      pattern: [
        {type:'buff',status:'strong',value:4,desc:'Rabid fury (+4 str)'},
        {type:'attack',value:21,desc:'Rabid bite for 21'},
        {type:'attack',value:21,desc:'Rabid bite for 21'},
        {type:'buff',status:'vulnerable',value:2,desc:'Pins you down'},
        {type:'attack',value:26,desc:'Death shake for 26'}
      ]
    }
  },
  vacuum_boss: {
    id: 'vacuum_boss', name: 'The Vacuum', hp: 210, maxHp: 210, block: 0, statuses: {},
    act: 2, elite: false, boss: true,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:18,desc:'Suction burst for 18'},
      {type:'attack',value:18,desc:'Suction burst for 18'},
      {type:'buff',status:'strong',value:5,desc:'Overheats (+5 str)'},
      {type:'attack',value:28,desc:'Mega suction for 28'},
      {type:'block',value:20,desc:'Full power (block 20)'}
    ],
    thresholdBehavior: {
      below: 0.5,
      pattern: [
        {type:'buff',status:'strong',value:6,desc:'Critical overheat (+6 str)'},
        {type:'attack',value:24,desc:'Vortex for 24'},
        {type:'attack',value:24,desc:'Vortex for 24'},
        {type:'block',value:25,desc:'Emergency shield (block 25)'},
        {type:'attack',value:30,desc:'Supernova suction for 30'}
      ]
    }
  },
  the_washing_machine: {
    id: 'the_washing_machine', name: 'The Washing Machine', hp: 230, maxHp: 230, block: 0, statuses: {},
    act: 2, elite: false, boss: true,
    emoji: '🫧',
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:16,desc:'Spin cycle for 16'},
      {type:'buff',status:'vulnerable',value:2,desc:'Tumble dry (2 vuln)'},
      {type:'attack',value:22,desc:'Rinse cycle for 22'},
      {type:'block',value:22,desc:'Soaks (block 22)'},
      {type:'attack',value:28,desc:'Full spin for 28'}
    ],
    thresholdBehavior: {
      below: 0.5,
      pattern: [
        {type:'buff',status:'vulnerable',value:3,desc:'Overloaded drum (3 vuln)'},
        {type:'attack',value:26,desc:'Violent spin for 26'},
        {type:'attack',value:26,desc:'Violent spin for 26'},
        {type:'buff',status:'strong',value:4,desc:'Motor overload (+4 str)'},
        {type:'attack',value:34,desc:'Catastrophic spin-out for 34'}
      ]
    }
  },
  the_vet: {
    id: 'the_vet', name: 'The Vet', hp: 280, maxHp: 280, block: 0, statuses: {},
    act: 3, elite: false, boss: true,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:20,desc:'Needle for 20'},
      {type:'buff',status:'vulnerable',value:3,desc:'Exposes weakness (3 vuln)'},
      {type:'attack',value:25,desc:'Scalpel for 25'},
      {type:'block',value:25,desc:'Puts on gloves (block 25)'},
      {type:'attack',value:35,desc:'Operation for 35'}
    ],
    thresholdBehavior: {
      below: 0.5,
      pattern: [
        {type:'buff',status:'vulnerable',value:4,desc:'Injects sedative (4 vuln)'},
        {type:'attack',value:30,desc:'Emergency surgery for 30'},
        {type:'buff',status:'strong',value:5,desc:'Adrenaline surge (+5 str)'},
        {type:'attack',value:34,desc:'Final procedure for 34'}
      ]
    }
  }
};

export function getEnemiesForAct(act, isElite = false, isBoss = false) {
  return Object.values(ENEMIES).filter(e => e.act === act && !!e.elite === isElite && !!e.boss === isBoss);
}

// Floor-tier weights: how likely each tier is to appear on a given floor (0-5).
// Early floors bias toward 'early' enemies; late floors bias toward 'late'.
function _tierWeight(tier, floor) {
  // floor 0-1 = early, floor 2-3 = mid, floor 4-5 = late
  if (tier === 'any') return 3;
  if (tier === 'early') return floor <= 1 ? 5 : floor <= 3 ? 2 : 1;
  if (tier === 'mid')   return floor <= 1 ? 1 : floor <= 3 ? 5 : 2;
  if (tier === 'late')  return floor <= 1 ? 1 : floor <= 3 ? 2 : 5;
  return 1;
}

export function getRandomEnemy(act, isElite = false, floor = 0) {
  const pool = getEnemiesForAct(act, isElite, false);
  if (pool.length === 0) return null;
  // Weighted selection by floor tier
  const weights = pool.map(e => _tierWeight(e.floorTier || 'any', floor));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return JSON.parse(JSON.stringify(pool[i]));
  }
  return JSON.parse(JSON.stringify(pool[pool.length - 1]));
}

export function getBoss(act) {
  const bosses = Object.values(ENEMIES).filter(e => e.boss && e.act === act);
  return JSON.parse(JSON.stringify(bosses[Math.floor(Math.random() * bosses.length)]));
}
