db = db.getSiblingDB('sylentx');


db.createUser({
    user: 'leavemealone',
    pwd: 'random_pass',
    roles: [
      {
        role: 'dbOwner',
      db: 'sylentx',
    },
  ],
});