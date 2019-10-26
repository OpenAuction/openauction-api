const pm2 = require('pm2');

const instances = -1;
const maxMemory = process.env.WEB_MEMORY || 1024;

pm2.connect(() => {
  pm2.start(
    {
      script: './bin/www',
      name: 'openauction-prod',
      exec_mode: 'cluster',
      instances,
      max_memory_restart: `${maxMemory}M`,
    },
    err => {
      if (err)
        return console.error(
          'Error while launching applications',
          err.stack || err
        );
      console.log('PM2 and application has been succesfully started');

      // Display logs in standard output
      pm2.launchBus((error, bus) => {
        console.log('[PM2] Log streaming started');

        bus.on('log:out', packet => {
          console.log('[App:%s] %s', packet.process.name, packet.data);
        });

        bus.on('log:err', packet => {
          console.error('[App:%s][Err] %s', packet.process.name, packet.data);
        });
      });
    }
  );
});
