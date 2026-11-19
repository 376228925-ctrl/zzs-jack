import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateUser,
  canManageAdmins,
  canPublishTournament,
  createSeedUsers,
  registerNewAccount,
  updateUserRoleByAdmin,
} from './authStore';

test('Super Admin Jack authenticates with configured password and has full RBAC permissions', () => {
  const users = createSeedUsers();
  const ok = authenticateUser(users, 'Jack', '18565608563');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.user.role, 'super_admin');
    assert.equal(canManageAdmins(ok.user), true);
    assert.equal(canPublishTournament(ok.user), true);
  }

  const bad = authenticateUser(users, 'Jack', 'wrong-pass');
  assert.equal(bad.ok, false);
});

test('Only super_admin can promote or demote admins; regular members cannot publish', () => {
  const users = createSeedUsers();
  const jack = users.find((u) => u.username === 'Jack')!;
  const member = users.find((u) => u.username === 'zhixia')!;
  const admin = users.find((u) => u.username === 'linxu')!;

  assert.equal(canPublishTournament(member), false);
  assert.equal(canPublishTournament(admin), true);
  assert.equal(canManageAdmins(admin), false);

  // Admin cannot promote
  const denied = updateUserRoleByAdmin(users, admin, member.id, 'admin');
  assert.equal(denied.ok, false);

  // Super admin Jack can promote member -> admin
  const promoted = updateUserRoleByAdmin(users, jack, member.id, 'admin');
  assert.equal(promoted.ok, true);
  if (promoted.ok) {
    const updatedMember = promoted.nextUsers.find((u) => u.id === member.id)!;
    assert.equal(updatedMember.role, 'admin');
    assert.equal(canPublishTournament(updatedMember), true);
  }
});

test('registerNewAccount creates isolated member account and rejects duplicates', () => {
  const users = createSeedUsers();
  const res = registerNewAccount(users, {
    username: 'alex_pb',
    password: 'password123',
    displayName: '阿乐',
    gender: 'M',
    dupr: 3.7,
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.user.role, 'member');
    const dup = registerNewAccount(res.nextUsers, {
      username: 'ALEX_PB',
      password: 'password123',
      displayName: '阿乐2',
      gender: 'M',
      dupr: 3.5,
    });
    assert.equal(dup.ok, false);
  }
});
