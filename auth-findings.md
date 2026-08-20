# Auth System Findings

## Users
- Afonso (ID 1, admin): afonsoqueirogagn@gmail.com
- Junior (ID 24870001, comprador): frotas.patrimonio@qualities.com.br - "Luiz Antonio jr"

## Current Auth Flow
- Universal password from system_settings table (currently "Quali319918")
- If password != universal, checks individual passwordHash (bcrypt)
- ADM Master is hardcoded to afonsoqueirogagn@gmail.com

## Plan
1. Set Afonso's individual passwordHash to bcrypt("Samuelqg123")
2. Change universal password to "Quali319918" (confirm it's already this)
3. Update login: check individual password FIRST, then universal
4. Add role "buyer_senior" for Junior
5. Add endpoint to edit proposal prices (buyer_senior + admin only)
