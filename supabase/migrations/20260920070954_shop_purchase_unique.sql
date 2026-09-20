-- Prevent two concurrent idempotency keys from purchasing the same item.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_purchase_once
  ON public.transactions (player_id, ((metadata_json->>'itemId')))
  WHERE type = 'spend'
    AND (source = 'teleplay-shop' OR source LIKE 'game-shop:%')
    AND metadata_json ? 'itemId';
