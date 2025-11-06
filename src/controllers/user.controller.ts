import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    NotFoundException
} from '@nestjs/common';
import { UserService } from '../services/user.service';

class CreateUserDto {
    name: string;
    password: string;
}

class UpdateUserDto {
    name?: string;
    password?: string;
}

class AddFingerprintDto {
    fingerprintId: number;
}

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UserService) { }

    @Post()
    async create(@Body() createUserDto: CreateUserDto) {
        try {
            const user = await this.usersService.create(createUserDto);
            return {
                success: true,
                data: {
                    id: user._id,
                    name: user.name,
                    fingerprints: user.fingerprints
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    @Get()
    async findAll() {
        const users = await this.usersService.findAll();
        return {
            success: true,
            data: users.map(user => ({
                id: user._id,
                name: user.name,
                fingerprints: user.fingerprints
            }))
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const user = await this.usersService.findById(id);
        if (!user) {
            return {
                success: false,
                error: 'User not found'
            };
        }
        return {
            success: true,
            data: {
                id: user._id,
                name: user.name,
                fingerprints: user.fingerprints
            }
        };
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        try {
            const user = await this.usersService.update(id, updateUserDto);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            return {
                success: true,
                data: {
                    id: user._id,
                    name: user.name,
                    fingerprints: user.fingerprints
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        try {
            await this.usersService.delete(id);
            return {
                success: true,
                message: 'User deleted successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    @Post(':id/fingerprints')
    async addFingerprint(
        @Param('id') id: string,
        @Body() addFingerprintDto: AddFingerprintDto
    ) {
        try {
            const user = await this.usersService.addFingerprint(id, addFingerprintDto.fingerprintId);
            if (!user) {
                throw new NotFoundException('User not found');
            }
            return {
                success: true,
                data: {
                    id: user._id,
                    name: user.name,
                    fingerprints: user.fingerprints
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    @Delete(':id/fingerprints/:fingerprintId')
    async removeFingerprint(
        @Param('id') id: string,
        @Param('fingerprintId') fingerprintId: number
    ) {
        try {
            const user = await this.usersService.removeFingerprint(id, fingerprintId);
            if (!user) {
                throw new NotFoundException('User not found');
            }
            return {
                success: true,
                data: {
                    id: user._id,
                    name: user.name,
                    fingerprints: user.fingerprints
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    @Get('fingerprint/:fingerprintId')
    async findByFingerprint(@Param('fingerprintId') fingerprintId: number) {
        const user = await this.usersService.findByFingerprint(fingerprintId);
        if (!user) {
            return {
                success: false,
                error: 'No user found with this fingerprint'
            };
        }
        return {
            success: true,
            data: {
                id: user._id,
                name: user.name,
                fingerprints: user.fingerprints
            }
        };
    }

    @Post('auth/login')
    async login(@Body() loginDto: { name: string; password: string }) {
        const user = await this.usersService.validateUser(loginDto.name, loginDto.password);
        if (!user) {
            return {
                success: false,
                error: 'Invalid credentials'
            };
        }
        return {
            success: true,
            data: {
                id: user._id,
                name: user.name,
                fingerprints: user.fingerprints
            }
        };
    }
}