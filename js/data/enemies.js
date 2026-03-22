export const ENEMIES = {
  // ACT 1
  yarn_golem: {
    id: 'yarn_golem', name: 'Yarn Golem', hp: 45, maxHp: 45, block: 0, statuses: {},
    act: 1, elite: false,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:8,desc:'Tangles you for 8'},
      {type:'block',value:10,desc:'Winds up (block 10)'},
      {type:'attack',value:12,desc:'Unravels for 12'}
    ]
  },
  laser_sprite: {
    id: 'laser_sprite', name: 'Laser Sprite', hp: 35, maxHp: 35, block: 0, statuses: {},
    act: 1, elite: false,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:6,desc:'Zips for 6'},
      {type:'attack',value:6,desc:'Zips for 6'},
      {type:'buff',status:'strong',value:2,desc:'Charges up'}
    ]
  },
  moth_swarm: {
    id: 'moth_swarm', name: 'Moth Swarm', hp: 30, maxHp: 30, block: 0, statuses: {},
    act: 1, elite: false,
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
    act: 2, elite: false,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:12,desc:'Barks for 12'},
      {type:'block',value:12,desc:'Guards (block 12)'},
      {type:'attack',value:16,desc:'Bites for 16'}
    ]
  },
  vacuum_cleaner: {
    id: 'vacuum_cleaner', name: 'Vacuum Cleaner', hp: 65, maxHp: 65, block: 0, statuses: {},
    act: 2, elite: false,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:10,desc:'Sucks for 10'},
      {type:'attack',value:10,desc:'Sucks for 10'},
      {type:'buff',status:'strong',value:3,desc:'Powers up'}
    ]
  },
  squirrel: {
    id: 'squirrel', name: 'Squirrel', hp: 55, maxHp: 55, block: 0, statuses: {},
    act: 2, elite: false,
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
  // ACT 3
  alley_cat: {
    id: 'alley_cat', name: 'Alley Cat', hp: 80, maxHp: 80, block: 0, statuses: {},
    act: 3, elite: false,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:14,desc:'Street swipes for 14'},
      {type:'attack',value:14,desc:'Street swipes for 14'},
      {type:'block',value:15,desc:'Dodges (block 15)'}
    ]
  },
  robot_cat: {
    id: 'robot_cat', name: 'Robot Cat', hp: 85, maxHp: 85, block: 0, statuses: {},
    act: 3, elite: false,
    moveIndex: 0,
    movePattern: [
      {type:'attack',value:16,desc:'Laser eyes for 16'},
      {type:'buff',status:'strong',value:3,desc:'Overclocks'},
      {type:'attack',value:20,desc:'Rocket paws for 20'}
    ]
  },
  feral_pigeon: {
    id: 'feral_pigeon', name: 'Feral Pigeon', hp: 75, maxHp: 75, block: 0, statuses: {},
    act: 3, elite: false,
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
        {type:'attack',value:28,desc:'Rabid bite for 28'},
        {type:'attack',value:28,desc:'Rabid bite for 28'},
        {type:'buff',status:'vulnerable',value:2,desc:'Pins you down'},
        {type:'attack',value:35,desc:'Death shake for 35'}
      ]
    }
  },
  vacuum_boss: {
    id: 'vacuum_boss', name: 'The Vacuum', hp: 180, maxHp: 180, block: 0, statuses: {},
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
        {type:'attack',value:32,desc:'Vortex for 32'},
        {type:'attack',value:32,desc:'Vortex for 32'},
        {type:'block',value:25,desc:'Emergency shield (block 25)'},
        {type:'attack',value:40,desc:'Supernova suction for 40'}
      ]
    }
  },
  the_vet: {
    id: 'the_vet', name: 'The Vet', hp: 200, maxHp: 200, block: 0, statuses: {},
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
        {type:'attack',value:40,desc:'Emergency surgery for 40'},
        {type:'buff',status:'strong',value:5,desc:'Adrenaline surge (+5 str)'},
        {type:'attack',value:45,desc:'Final procedure for 45'}
      ]
    }
  }
};

export function getEnemiesForAct(act, isElite = false, isBoss = false) {
  return Object.values(ENEMIES).filter(e => e.act === act && !!e.elite === isElite && !!e.boss === isBoss);
}

export function getRandomEnemy(act, isElite = false) {
  const pool = getEnemiesForAct(act, isElite, false);
  return JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
}

export function getBoss(act) {
  const bosses = Object.values(ENEMIES).filter(e => e.boss && e.act === act);
  return JSON.parse(JSON.stringify(bosses[0]));
}
