import { Router } from 'express';
import {
  acceptGroupInvite,
  cancelSentGroupInvite,
  createGroup,
  deleteGroup,
  demoteMember,
  getGroupMembers,
  getGroupPublicProfile,
  getGroupRanking,
  getMyGroupWorkspace,
  getMyGroups,
  getMyPendingGroupInvites,
  getMySentGroupInvites,
  inviteToGroup,
  leaveGroup,
  promoteMember,
  rejectGroupInvite,
  removeGroupMember,
  searchGroupsByName,
  updateGroupName,
  updateGroupPhoto,
  updateGroupBudget,
  updateGroupDescription,
  updateGroupPrivacy,
} from '../controllers/groups.controller';
import { authenticate, optionalAuth } from '../middleware/auth';

const groupsRouter = Router();

groupsRouter.get('/search', optionalAuth, searchGroupsByName);
groupsRouter.get('/:id_gruppo/members', optionalAuth, getGroupMembers);
groupsRouter.get('/:id_gruppo/profile', optionalAuth, getGroupPublicProfile);
groupsRouter.get('/:id_gruppo/ranking', optionalAuth, getGroupRanking);
groupsRouter.get('/:id_gruppo/workspace', authenticate, getMyGroupWorkspace);

groupsRouter.post('/', authenticate, createGroup);
groupsRouter.get('/mine', authenticate, getMyGroups);
groupsRouter.delete('/:id_gruppo', authenticate, deleteGroup);
groupsRouter.patch('/:id_gruppo/privacy', authenticate, updateGroupPrivacy);
groupsRouter.patch('/:id_gruppo/name', authenticate, updateGroupName);
groupsRouter.patch('/:id_gruppo/description', authenticate, updateGroupDescription);
groupsRouter.patch('/:id_gruppo/photo', authenticate, updateGroupPhoto);

groupsRouter.post('/:id_gruppo/invites', authenticate, inviteToGroup);
groupsRouter.delete('/:id_gruppo/invites/:id_persona', authenticate, cancelSentGroupInvite);
groupsRouter.get('/invites/pending', authenticate, getMyPendingGroupInvites);
groupsRouter.get('/invites/sent', authenticate, getMySentGroupInvites);
groupsRouter.post('/invites/:id_gruppo/accept', authenticate, acceptGroupInvite);
groupsRouter.post('/invites/:id_gruppo/reject', authenticate, rejectGroupInvite);

groupsRouter.put('/:id_gruppo/budget', authenticate, updateGroupBudget);

groupsRouter.delete('/:id_gruppo/members/:id_persona', authenticate, removeGroupMember);
groupsRouter.post('/:id_gruppo/members/:id_persona/promote', authenticate, promoteMember);
groupsRouter.post('/:id_gruppo/members/:id_persona/demote', authenticate, demoteMember);
groupsRouter.post('/:id_gruppo/leave', authenticate, leaveGroup);

export default groupsRouter;
