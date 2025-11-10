import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Fingerprint, FingerprintSchema, FingerprintDocument } from '../models/fingerprint.schema';
import { User, UserDocument } from '../models/user.schema';

const MAX_FINGERPRINT_ID = 999;

@Injectable()
export class FingerprintService {
  constructor(
    @InjectModel(Fingerprint.name) private fingerprintModel: Model<FingerprintDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}
  async claimNewFingerprintId(userId: string): Promise<number> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User not found.`);
    }

    const MAX_RETRIES = 10; 
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const potentialId = Math.floor(Math.random() * (MAX_FINGERPRINT_ID + 1));

      try {
        const claimedFingerprint = await this.fingerprintModel.create({
          id: potentialId,
          userId: userId,
        });

        await this.userModel.updateOne(
          { _id: userId },
          { $addToSet: { fingerprints: potentialId } },
        ).exec();

        return claimedFingerprint.id;

      } catch (error) {
        if (error.code === 11000) {
          console.warn(`Attempt ${attempt + 1}: Fingerprint ID ${potentialId} is already in use. Retrying...`);
          continue; 
        }

        throw new InternalServerErrorException('Database error during fingerprint ID assignment.');
      }
    }

    throw new ConflictException('Failed to find an available fingerprint ID after multiple retries. The AS608 storage might be full.');
  }
  async releaseFingerprintId(userId: string, fingerprintId: number): Promise<void> {
    const result = await this.fingerprintModel.deleteOne({ 
      id: fingerprintId, 
      userId: userId 
    }).exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Fingerprint ID ${fingerprintId} not found or not owned by user ${userId}.`);
    }

    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { fingerprints: fingerprintId } },
    ).exec();
  }
}