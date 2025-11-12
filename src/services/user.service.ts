import { Model } from 'mongoose';
import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../models/user.schema';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { FingerprintService } from './fingerprint.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private readonly fingerprintService: FingerprintService,
  ) { }

  async create(userData: Partial<User>): Promise<UserDocument> {
    try {
      const existingUser = await this.userModel.findOne({ name: userData.name }).exec();
      if (existingUser) {
        throw new ConflictException('Username already exists');
      }

      const user = new this.userModel(userData);
      return await user.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Username already exists');
      }
      throw new BadRequestException('Invalid user data');
    }
  }

  async createAdmin(userData: Partial<User>): Promise<UserDocument> {
    const existingUser = await this.userModel.findOne({ name: userData.name }).exec();
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }
    const user = new this.userModel({
      ...userData,
      isAdmin: true
    });

    return user.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByName(username: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ name: username });
    if (!user) {
      return null;
    }
    return user;
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async validateUser(name: string, password: string): Promise<{ access_token: string }> {
    const user = await this.userModel.findOne({ name }).select('+isAdmin').exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      userId: user._id,
      username: user.name,
      isAdmin: user.isAdmin
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async update(id: string, updateData: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async delete(userId: string, deviceId: string, apiKey: string): Promise<void> {

    await this.fingerprintService.deleteAllFingerprintsByUser(userId, deviceId, apiKey);

    await this.userModel.findByIdAndDelete(userId).exec();
  }
}