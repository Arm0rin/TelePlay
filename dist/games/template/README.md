# TelePlay Game Template

1. Скопируйте папку `games/template` в `games/<game-id>`.
2. Опишите настройки в `config.js`.
3. Реализуйте `GameModule` с методами `init`, `start`, `pause`, `resume`, `restart`, `destroy`.
4. Добавьте игру в `dist/games.js` с `component` и `engineType`.
5. Выберите адаптер: `CanvasGameAdapter`, `PuzzleGameAdapter` или `SportsGameAdapter`.
6. Зарегистрируйте модуль в `GameSession`.
7. Используйте `PlayerData`/`SaveManager` для прогресса и `RewardManager` для TeleCoins.
8. Отправляйте стандартные события через `Analytics`.
9. Подключите файлы игры в `index.html` только один раз.

Игровой модуль не должен напрямую обращаться к `localStorage` или менять глобальный баланс.
