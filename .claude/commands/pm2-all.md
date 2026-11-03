Start all services and open PM2 monitor.
```bash
cd "D:/Projects/retail-store-management-system" && pm2 start ecosystem.config.cjs && start wt.exe -d "D:/Projects/retail-store-management-system" pwsh -NoExit -c "pm2 monit"
```
