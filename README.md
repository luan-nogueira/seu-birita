# Sistema Seu Birita Distribuidora

Sistema de pedidos, acerto de consignação, clientes e financeiro — feito pra
usar no celular (no galpão e no evento) e também no computador.

## Rodando

```bash
npm install
npm run dev
```

Abre em <http://localhost:3000>.

Sem configurar o Firebase o sistema entra em **modo demonstração**: os dados
ficam salvos só no navegador, já com o catálogo de produtos da planilha antiga
carregado. Dá pra navegar e testar tudo antes de criar qualquer conta.

## Ligando o Firebase

O projeto já aponta pro Firebase **`seu-birita`** (veja `.firebaserc`), com
Firestore e login por e-mail/senha.

O primeiro passo é interativo (abre o navegador), então precisa ser feito à mão:

```bash
npx -y firebase-tools@latest login
```

Depois, o restante:

```bash
# 1. Confirma o projeto ativo
npx -y firebase-tools@latest use seu-birita

# 2. Registra o app web (só na primeira vez)
npx -y firebase-tools@latest apps:create WEB "Sistema Seu Birita"

# 3. Pega a configuração e joga em .env.local
npx -y firebase-tools@latest apps:sdkconfig WEB

# 4. Liga o login por e-mail/senha (lê o bloco "auth" do firebase.json)
npx -y firebase-tools@latest deploy --only auth

# 5. Publica as regras de segurança
npx -y firebase-tools@latest deploy --only firestore:rules
```

Copie `.env.local.example` para `.env.local` e preencha com o que o passo 3
devolveu. Reinicie o `npm run dev`: o aviso de "modo demonstração" some e a tela
de login aparece.

Por fim, crie o usuário da equipe em
_Firebase Console → Authentication → Users → Add user_.

### Segurança

As regras em `firestore.rules` só liberam escrita pra quem está logado. A única
leitura pública é a coleção `produtos`, porque a tabela de preços em `/catalogo`
precisa abrir sem login — é o link que vai pro cliente.

O Firestore está configurado com **cache persistente**: o celular continua
funcionando sem sinal no galpão e sincroniza sozinho quando a internet volta.

## Como o negócio é modelado

A distribuidora trabalha de dois jeitos, e o pedido carrega essa distinção:

| Tipo             | Como funciona                                                       |
| ---------------- | ------------------------------------------------------------------- |
| **Consignação**  | Entrega no evento → cliente devolve o que não vendeu → paga o saldo |
| **Venda direta** | Cliente compra e leva. Sem devolução.                               |

Cada produto guarda quantas unidades vêm na caixa (Corona 24, Coca 12, Suco 6),
então tudo pode ser lançado em **caixas + unidades avulsas** e o sistema
converte. Um pedido aceita várias remessas ("Entrega 1", "Entrega 2"), igual às
colunas `PEDIDO 01` / `PEDIDO 02` da planilha antiga.

O acerto fecha assim:

```
consumo        = (entregue − devolvido) × preço
total a receber = consumo − desconto + pendência anterior
falta receber   = total a receber − pago
```

### Conferência com a planilha real

`npm run verificar` roda o acerto do Estação Lounge (o da foto) pelo código do
sistema e compara com os totais da planilha:

```
OK    Valor do pedido (mercadoria entregue)   R$ 15.018,00
OK    Valor final (consumo)                    R$  3.556,20
OK    Pendência anterior                       R$  4.617,00
OK    Total a receber                          R$  8.173,20
```

## Telas

| Rota               | O que é                                                        |
| ------------------ | -------------------------------------------------------------- |
| `/`                | Painel: a receber, faturado no mês, contas em aberto           |
| `/pedidos`         | Lista de pedidos com filtro por status e por cliente           |
| `/pedidos/[id]`    | Montagem do pedido, devolução, fechamento e pagamento          |
| `/pedidos/[id]/relatorio` | Relatório A4 com a logo — imprime ou salva em PDF       |
| `/produtos`        | Catálogo, preços, un/caixa e importação em massa               |
| `/clientes`        | Cadastro, pendência por cliente, atalho pro WhatsApp           |
| `/financeiro`      | A receber por cliente e histórico de recebimentos              |
| `/catalogo`        | **Tabela de preços pública** — o link que vai pro cliente      |
| `/login`           | Entrada da equipe (e-mail/senha)                               |
| `/estoque`, `/fornecedores` | Próxima etapa                                         |

## A fazer

- [x] Firebase ligado: Firestore `(default)` STANDARD em `southamerica-east1`,
      regras publicadas, login por e-mail/senha ativo
- [ ] Colocar a logo oficial em `public/logo.png` (hoje há um letreiro em SVG
      no lugar; o componente troca sozinho quando o arquivo existir)
- [ ] Apagar o Realtime Database `seu-birita-default-rtdb`, criado por engano
      e não usado pelo sistema
- [ ] Módulo de estoque: entrada por compra, baixa automática pelo pedido
- [ ] Cadastro de fornecedores com custo por produto
- [ ] Tela de configurações da empresa (hoje em `src/lib/empresa.ts`)
- [ ] Domínio próprio pra tabela pública, no lugar do `seubirita.kyte.site`

## Estrutura

```
src/
  app/            telas (App Router, tudo client-side)
  components/     peças reaproveitadas de interface
  lib/
    types.ts      modelo de domínio
    calc.ts       regras de cálculo do acerto
    store.tsx     estado global + acesso a dados
    db/           adaptadores: Firestore e navegador (demonstração)
scripts/
  verificar-calculo.ts   conferência contra a planilha real
```
