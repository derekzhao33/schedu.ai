import app from './app';
import config from './config/config';

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Server running on port ${config.port}`);
});