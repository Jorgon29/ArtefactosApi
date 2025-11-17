import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Fingerprint, FingerprintSchema, FingerprintDocument } from '../models/fingerprint.schema';
import { User, UserDocument } from '../models/user.schema';
import { MqttService } from './mqtt.service';

const MAX_FINGERPRINT_ID = 999;

@Injectable()
export class FingerprintService {
  constructor(
    @InjectModel(Fingerprint.name) private fingerprintModel: Model<FingerprintDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: MqttService,
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

  async deleteAllFingerprintsByUser(userId: string, deviceId: string, apiKey: string): Promise<void> {
    const fingerprints = await this.fingerprintModel.find({ userId }).exec();
    await Promise.allSettled(fingerprints.map(fp => {
      return this.mqttService.sendCommand(
        deviceId,
        apiKey,
        'DELETE',
        { fingerprintId: fp.id }
      );
    }));

    await this.fingerprintModel.deleteMany({ userId }).exec();
  }

  async releaseFingerprintIdOnFailure(fingerprintId: number): Promise<void> {
    const fingerprintDoc = await this.fingerprintModel.findOne({ id: fingerprintId }).exec();
    if (!fingerprintDoc) {
      console.warn(`Rollback: Fingerprint ID ${fingerprintId} was already deleted.`);
      return;
    }

    const userId = fingerprintDoc.userId.toString();
    await this.fingerprintModel.deleteOne({ id: fingerprintId }).exec();

    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { fingerprints: fingerprintId } },
    ).exec();
    
    console.log(`Rollback: Successfully released FID ${fingerprintId} from user ${userId}.`);
  }
}