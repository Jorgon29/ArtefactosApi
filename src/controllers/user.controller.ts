import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    NotFoundException,
    UseGuards
} from '@nestjs/common';
import { UserService } from '../services/user.service';

import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnershipGuard } from '../auth/ownership.guard';
import { AdminGuard } from 'src/auth/admin_guard';

class CreateUserDto {
    name: string;
    password: string;
}

class UpdateUserDto {
    name?: string;
    password?: string;
}

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UserService) { }

    @UseGuards(JwtAuthGuard, AdminGuard)
    @Post()
    async create(@Body() createUserDto: CreateUserDto) {
        try {
            const user = await this.usersService.create(createUserDto);
            return {
                success: true,
                data: {
                    id: user._id,
                    name: user.name
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll() {
        const users = await this.usersService.findAll();
        return {
            success: true,
            data: users.map(user => ({
                id: user._id,
                name: user.name
            }))
        };
    }

    @UseGuards(JwtAuthGuard)
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
                name: user.name
            }
        };
    }

    @UseGuards(JwtAuthGuard, OwnershipGuard)
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
                    name: user.name
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    @UseGuards(JwtAuthGuard, OwnershipGuard)
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
                token: user
            }
        };
    }
}