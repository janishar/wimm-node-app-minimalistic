import User, { UserModel } from '../model/User';
import { RoleModel } from '../model/Role';
import { InternalError } from '../../core/ApiError';
import { Types } from 'mongoose';
import KeystoreRepo from './KeystoreRepo';
import Keystore from '../model/Keystore';

const USER_CRITICAL_DETAIL = '+email +password +roles +googleId +facebookId';

async function exists(id: Types.ObjectId): Promise<boolean> {
  const user = await UserModel.exists({ _id: id, status: true });
  return user !== null && user !== undefined;
}

async function findPrivateProfileById(
  id: Types.ObjectId,
): Promise<User | null> {
  return UserModel.findOne({ _id: id, status: true })
    .select('+email')
    .populate({
      path: 'roles',
      match: { status: true },
      select: { code: 1 },
    })
    .lean<User>()
    .exec();
}

// contains critical information of the user
async function findById(id: Types.ObjectId): Promise<User | null> {
  return UserModel.findOne({ _id: id, status: true })
    .select(USER_CRITICAL_DETAIL)
    .populate({
      path: 'roles',
      match: { status: true },
    })
    .lean()
    .exec();
}

async function findByEmail(email: string): Promise<User | null> {
  return UserModel.findOne({ email: email })
    .select(USER_CRITICAL_DETAIL)
    .populate({
      path: 'roles',
      match: { status: true },
    })
    .lean()
    .exec();
}

async function findUserByDeviceId(deviceId: string): Promise<User | null> {
  return UserModel.findOne({ deviceId: deviceId })
    .select(USER_CRITICAL_DETAIL)
    .populate({
      path: 'roles',
      match: { status: true },
    })
    .lean()
    .exec();
}

async function findFieldsById(
  id: Types.ObjectId,
  ...fields: string[]
): Promise<User | null> {
  return UserModel.findOne({ _id: id, status: true }, [...fields])
    .lean()
    .exec();
}

async function findPublicProfileById(id: Types.ObjectId): Promise<User | null> {
  return UserModel.findOne({ _id: id, status: true }).lean().exec();
}

async function create(
  user: User,
  accessTokenKey: string,
  refreshTokenKey: string,
  roleCode: string,
): Promise<{ user: User; keystore: Keystore }> {
  const now = new Date();

  const role = await RoleModel.findOne({ code: roleCode })
    .select('+code')
    .lean()
    .exec();
  if (!role) throw new InternalError('Role must be defined');

  user.roles = [role];
  user.createdAt = user.updatedAt = now;
  const createdUser = await UserModel.create(user);
  const keystore = await KeystoreRepo.create(
    createdUser,
    accessTokenKey,
    refreshTokenKey,
  );
  return {
    user: { ...createdUser.toObject(), roles: user.roles },
    keystore: keystore,
  };
}

async function update(
  user: User,
  accessTokenKey: string,
  refreshTokenKey: string,
): Promise<{ user: User; keystore: Keystore }> {
  user.updatedAt = new Date();
  await UserModel.updateOne({ _id: user._id }, { $set: { ...user } })
    .lean()
    .exec();
  const keystore = await KeystoreRepo.create(
    user,
    accessTokenKey,
    refreshTokenKey,
  );
  return { user: user, keystore: keystore };
}

async function updateInfo(user: User): Promise<any> {
  user.updatedAt = new Date();
  return UserModel.updateOne({ _id: user._id }, { $set: { ...user } })
    .lean()
    .exec();
}

async function removeDeviceId(user: User, status: boolean): Promise<User> {
  user.updatedAt = new Date();
  return UserModel.updateOne(
    { _id: user._id },
    { $unset: { deviceId: 1 }, $set: { status: status } },
  )
    .lean()
    .exec()
    .then((result) => {
      if (!result || result.modifiedCount != 1) throw new InternalError();
      return Promise.resolve(user);
    });
}

async function findFieldsByIds(
  ids: Types.ObjectId[],
  ...fields: string[]
): Promise<User[]> {
  return UserModel.find({ _id: { $in: ids }, status: true }, [...fields])
    .lean()
    .exec();
}

export default {
  exists,
  findPrivateProfileById,
  findById,
  findByEmail,
  findFieldsById,
  findPublicProfileById,
  create,
  update,
  updateInfo,
  removeDeviceId,
  findUserByDeviceId,
  findFieldsByIds,
};
