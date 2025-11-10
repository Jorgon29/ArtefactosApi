import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../services/user.service';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  const configService = app.get(ConfigService);

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.error('Admin credentials not configured in environment variables');
    console.error('Please set:');
    console.error('ADMIN_USERNAME=your_username');
    console.error('ADMIN_PASSWORD=your_password');
    process.exit(1);
  }

  if (adminPassword.length < 8) {
    console.error('Admin password must be at least 8 characters long');
    process.exit(1);
  }

  if (adminPassword === 'admin123' || adminPassword === 'password') {
    console.error('Admin password is too weak. Choose a stronger password.');
    process.exit(1);
  }

  try {
    const existingAdmin = await userService.findByName(adminUsername);
    
    if (existingAdmin) {
      if (existingAdmin.isAdmin) {
        console.log('Admin user already exists');
        console.log(`Username: ${adminUsername}`);
      } else {
        console.error('Security violation: Regular user exists with admin username');
        console.error('Please choose a different ADMIN_USERNAME or delete the existing user');
        process.exit(1);
      }
    } else {
      await userService.createAdmin({
        name: adminUsername,
        password: adminPassword
      });
      console.log('Admin user created successfully!');
    }
    
  } catch (error) {
    if (error.code === 11000) {
      console.error('Admin user already exists (duplicate key error)');
    } else {
      console.error('Error creating admin user:', error.message);
    }
    process.exit(1);
  }

  await app.close();
  console.log('Admin setup completed successfully!');
}

bootstrap();