-- PARCHE DE SINCRONIZACIÓN RECIENTE
SET session_replication_role = 'replica';

-- Insertando en orders (2 registros)
INSERT INTO orders (id, customer_id, employee_id, status, total, payment_method, order_number, service_type, table_id, notes, created_at, updated_at, amount_paid, payment_status) VALUES 
('c1980da2-e089-44e3-b1bf-1729ee9f68a2', NULL, '2a7c431f-c532-4057-ac89-07a87019337d', 'completed', 930, 'cash', 1, 'takeaway', NULL, '', '2026-05-08T10:40:15.027614+00:00', '2026-05-08T10:40:15.027614+00:00', 930, 'paid'),
('8e2d4ab1-5df2-41be-9670-169e93322d64', NULL, '2a7c431f-c532-4057-ac89-07a87019337d', 'completed', 600, 'cash', 2, 'takeaway', NULL, '', '2026-05-08T14:00:38.153428+00:00', '2026-05-08T14:00:38.153428+00:00', 600, 'paid') ON CONFLICT (id) DO NOTHING;

-- Insertando en order_items (3 registros)
INSERT INTO order_items (id, order_id, product_id, size_id, quantity, unit_price, subtotal, notes, created_at, purchase_price) VALUES 
('ee74b2a7-76ea-44e2-a30e-38af0d4994c1', 'c1980da2-e089-44e3-b1bf-1729ee9f68a2', '68e14e06-891a-428f-bfb8-cf9b25f9ca2f', '374a3992-7598-42be-ab71-32455a4b8433', 1, 350, 350, '', '2026-05-08T10:40:15.659499+00:00', 250),
('85c8e490-950a-4e89-806a-fb2a78c44464', 'c1980da2-e089-44e3-b1bf-1729ee9f68a2', '1722a7bb-19e9-46f5-8777-50057f69cac0', '4bba3f0a-47ce-4696-b7c8-bacebc3df3d0', 1, 580, 580, '', '2026-05-08T10:40:15.659499+00:00', 380),
('fcd1e09f-0bf6-40b2-8bdb-18c3467e59c7', '8e2d4ab1-5df2-41be-9670-169e93322d64', '8d39c122-64bb-4637-8757-981155ef83cd', '9c8ed5ae-36a5-4eb8-901e-ea51cce602a0', 1, 600, 600, '', '2026-05-08T14:00:38.765409+00:00', 400) ON CONFLICT (id) DO NOTHING;

-- Insertando en order_history (2 registros)
INSERT INTO order_history (id, order_id, action, status, total, items, employee_id, created_at) VALUES 
('eba8637b-6e0e-4613-a84e-8a2b2ffc50dd', 'c1980da2-e089-44e3-b1bf-1729ee9f68a2', 'created', 'completed', 930, NULL, '2a7c431f-c532-4057-ac89-07a87019337d', '2026-05-08T10:40:15.027614+00:00'),
('f8ed6a84-5b19-45bb-ad9b-8898b2d2d410', '8e2d4ab1-5df2-41be-9670-169e93322d64', 'created', 'completed', 600, NULL, '2a7c431f-c532-4057-ac89-07a87019337d', '2026-05-08T14:00:38.153428+00:00') ON CONFLICT (id) DO NOTHING;

-- Insertando en cash_register_sessions (1 registros)
INSERT INTO cash_register_sessions (id, employee_id, opening_amount, opened_at, closing_amount, closed_at, status, notes, created_at, updated_at) VALUES 
('7be33208-962c-4988-8497-1b0c51496a2a', '2a7c431f-c532-4057-ac89-07a87019337d', 135, '2026-05-08T09:56:43.772+00:00', NULL, NULL, 'open', NULL, '2026-05-08T09:56:52.078932+00:00', '2026-05-08T09:56:52.078932+00:00') ON CONFLICT (id) DO NOTHING;

SET session_replication_role = 'origin';
