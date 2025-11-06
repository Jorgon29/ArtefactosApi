import { Model } from 'mongoose';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/models/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

  async create(userData: Partial<User>): Promise<UserDocument> {
    try {
      const existingUser = await this.userModel.findOne({ name: userData.name }).exec();
      if (existingUser) {
        throw new ConflictException('Username already exists');
      }

      const user = new this.userModel(userData);
      return await user.save();
    } catch (error) {
      if (error.code === 11000) { // MongoDB duplicate key
        throw new ConflictException('Username already exists');
      }
      throw new BadRequestException('Invalid user data');
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async validateUser(name: string, password: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ name }).exec();

    if (user && await user.validatePassword(password)) {
      return user;
    }
    return null;
  }

  async addFingerprint(userId: string, fingerprintId: number): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { fingerprints: fingerprintId } },
      { new: true }
    ).exec();
  }

  async removeFingerprint(userId: string, fingerprintId: number): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { fingerprints: fingerprintId } },
      { new: true }
    ).exec();
  }

  async findByFingerprint(fingerprintId: number): Promise<UserDocument | null> {
    return this.userModel.findOne({ fingerprints: fingerprintId }).exec();
  }

  async update(id: string, updateData: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }
}