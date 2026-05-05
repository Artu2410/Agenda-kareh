#!/usr/bin/env node

import 'dotenv/config';
import { runCokibaSync } from '../src/services/cokibaSync.js';

runCokibaSync()
  .then((result) => {
    console.log('\n🎉 Proceso completado exitosamente');
    console.log(
      `   📊 Total sincronizadas: ${result.total} | Nuevas: ${result.created} | Actualizadas: ${result.updated}`
    );
  })
  .catch((error) => {
    console.error('\n❌ Error en el scraper COKIBA:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
