import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { as, migrate, newDb, user } from './helpers.mjs'

const addStaff = (db, name, email, role, userId, active = true) =>
  db.query(
    'insert into advisors (name, email, role, user_id, active) values ($1, $2, $3, $4, $5)',
    [name, email, role, userId, active],
  )

describe('003 · actualizar una base que ya tiene admins y asesores', () => {
  test('los admins pasan al equipo, los asesores se conservan y repetirla no duplica nada', async () => {
    const db = await newDb({ upTo: '002_asesores.sql' })
    const ana = await user(db, 'Ana@Kreer.test')
    const boss = await user(db, 'boss@kreer.test')
    await db.query('insert into admins (user_id) values ($1), ($2)', [ana, boss])
    await db.query(
      `insert into advisors (name, whatsapp, email) values
         ('Pedro', '593987654321', 'pedro@kreer.test'),
         ('Boss asesor', '593911111111', 'boss@kreer.test')`,
    )

    await migrate(db, '003_roles.sql')

    const rows = (await db.query('select name, email, role, active, assign_weight, whatsapp, user_id from advisors order by name')).rows
    assert.equal(rows.length, 3, 'Ana se agrega; Boss reutiliza su fila por correo')
    const by = (n) => rows.find((r) => r.name === n)
    assert.deepEqual([by('Ana').role, by('Ana').user_id], ['admin', ana])
    assert.equal(by('Ana').email, 'Ana@Kreer.test')
    assert.deepEqual([by('Boss asesor').role, by('Boss asesor').user_id], ['admin', boss])
    assert.deepEqual(
      [by('Pedro').role, by('Pedro').active, by('Pedro').assign_weight, by('Pedro').whatsapp, by('Pedro').user_id],
      ['asesor', true, 1, '593987654321', null],
    )

    await migrate(db, '003_roles.sql')
    assert.equal((await db.query('select count(*)::int n from advisors')).rows[0].n, 3)
  })

  test('la tabla admins queda intacta', async () => {
    const db = await newDb({ upTo: '002_asesores.sql' })
    const ana = await user(db, 'ana@kreer.test')
    await db.query('insert into admins (user_id) values ($1)', [ana])
    await migrate(db, '003_roles.sql')
    assert.equal((await db.query('select count(*)::int n from admins')).rows[0].n, 1)
  })
})

describe('003 · permisos por rol', () => {
  let db, u
  before(async () => {
    db = await newDb({ upTo: '003_roles.sql' })
    u = {}
    for (const k of ['admin', 'gerente', 'asesor', 'otro', 'inactivo', 'sinEquipo', 'legado'])
      u[k] = await user(db, `${k}@kreer.test`)
    await addStaff(db, 'Admin', 'admin@kreer.test', 'admin', u.admin)
    await addStaff(db, 'Gerente', 'gerente@kreer.test', 'gerente', u.gerente)
    await addStaff(db, 'Asesor', 'asesor@kreer.test', 'asesor', u.asesor)
    await addStaff(db, 'Otro', 'otro@kreer.test', 'asesor', u.otro)
    await addStaff(db, 'Inactivo', 'inactivo@kreer.test', 'asesor', u.inactivo, false)
    await db.query('insert into admins (user_id) values ($1)', [u.legado]) // admin legado, sin fila en el equipo
    await db.query(`insert into properties (title, operation, type, price, published) values
      ('Publicada', 'Venta', 'Casa', 100, true), ('Borrador', 'Venta', 'Casa', 200, false)`)
  })

  const roles = (uid) =>
    as(db, { uid }, async (q) =>
      (await q(`select staff_role() role, is_staff() staff, is_manager() manager, is_admin() adm,
                       can_manage_team() team, current_advisor_id() adv`)).rows[0])

  test('cada rol obtiene sus capacidades', async () => {
    const pick = ({ role, staff, manager, adm, team }) => [role, staff, manager, adm, team]
    assert.deepEqual(pick(await roles(u.admin)), ['admin', true, true, true, true])
    assert.deepEqual(pick(await roles(u.gerente)), ['gerente', true, true, true, false])
    assert.deepEqual(pick(await roles(u.asesor)), ['asesor', true, false, false, false])
    assert.deepEqual(pick(await roles(u.inactivo)), [null, false, false, false, false])
    assert.deepEqual(pick(await roles(u.sinEquipo)), [null, false, false, false, false])
    assert.deepEqual(pick(await roles(u.legado)), [null, false, false, true, true], 'el admin legado conserva acceso')
    assert.deepEqual(pick(await roles(null)), [null, false, false, false, false])
    assert.ok((await roles(u.asesor)).adv, 'un asesor activo tiene id de asesor')
    assert.equal((await roles(u.inactivo)).adv, null)
  })

  test('el equipo: todo el staff lo lee, solo admin lo modifica', async () => {
    const count = (uid, role) => as(db, { uid, role }, async (q) => (await q('select count(*)::int n from advisors')).rows[0].n)
    assert.equal(await count(u.asesor), 5)
    assert.equal(await count(u.gerente), 5)
    assert.equal(await count(u.legado), 5)
    assert.equal(await count(u.sinEquipo), 0, 'un usuario sin fila en el equipo no ve a nadie')
    assert.equal(await count(null, 'anon'), 0)

    for (const who of [u.asesor, u.gerente]) {
      await assert.rejects(as(db, { uid: who }, (q) => q("insert into advisors (name) values ('X')")), /row-level security/)
      const upd = await as(db, { uid: who }, (q) => q("update advisors set name = 'Hack'"))
      assert.equal(upd.affectedRows, 0)
      const del = await as(db, { uid: who }, (q) => q('delete from advisors'))
      assert.equal(del.affectedRows, 0)
    }

    await as(db, { uid: u.admin }, async (q) => {
      await q("insert into advisors (name, email, role) values ('Nuevo', 'nuevo@kreer.test', 'asesor')")
      assert.equal((await q("update advisors set assign_weight = 3 where name = 'Otro'")).affectedRows, 1)
    })
    await as(db, { uid: u.legado }, async (q) => {
      assert.equal((await q("update advisors set assign_weight = 2 where name = 'Otro'")).affectedRows, 1)
    })
  })

  test('el rol y el peso solo aceptan valores válidos', async () => {
    await assert.rejects(db.query("update advisors set role = 'jefe' where name = 'Otro'"), /advisors_role_check/)
    await assert.rejects(db.query("update advisors set assign_weight = 0 where name = 'Otro'"), /advisors_weight_check/)
  })

  test('propiedades: el público ve publicadas, el equipo ve también borradores', async () => {
    const titles = (uid, role) => as(db, { uid, role }, async (q) => (await q('select title from properties order by title')).rows.map((r) => r.title))
    assert.deepEqual(await titles(null, 'anon'), ['Publicada'], 'anon puede consultar sin error de permisos')
    assert.deepEqual(await titles(u.sinEquipo), ['Publicada'])
    assert.deepEqual(await titles(u.inactivo), ['Publicada'])
    assert.deepEqual(await titles(u.asesor), ['Borrador', 'Publicada'])
    assert.deepEqual(await titles(u.gerente), ['Borrador', 'Publicada'])
    assert.deepEqual(await titles(u.legado), ['Borrador', 'Publicada'])
  })

  test('propiedades: un asesor no escribe, la dirección sí', async () => {
    await assert.rejects(
      as(db, { uid: u.asesor }, (q) => q("insert into properties (title, operation, type, price) values ('X','Venta','Casa',1)")),
      /row-level security/,
    )
    const upd = await as(db, { uid: u.asesor }, (q) => q("update properties set title = 'Hack'"))
    assert.equal(upd.affectedRows, 0)
    await as(db, { uid: u.gerente }, async (q) => {
      assert.equal((await q("update properties set price = 1 where title = 'Borrador'")).affectedRows, 1)
    })
  })
})

describe('003 · my_staff() (primer ingreso)', () => {
  let db
  before(async () => { db = await newDb({ upTo: '003_roles.sql' }) })
  const me = (uid) => as(db, { uid }, async (q) => (await q('select * from my_staff()')).rows)

  test('vincula por correo confirmado, sin importar mayúsculas, y queda guardado', async () => {
    await db.query("insert into advisors (name, email) values ('Lucía', 'lucia@kreer.test')")
    const uid = await user(db, 'LUCIA@kreer.test')
    await as(db, { uid }, async (q) => {
      const rows = (await q('select * from my_staff()')).rows
      assert.deepEqual(rows.map((r) => [r.name, r.role, r.active]), [['Lucía', 'asesor', true]])
      assert.equal((await q("select user_id from advisors where name = 'Lucía'")).rows[0].user_id, uid)
    })
  })

  test('NO vincula si el correo no está confirmado', async () => {
    await db.query("insert into advisors (name, email) values ('Mario', 'mario@kreer.test')")
    const uid = await user(db, 'mario@kreer.test', false)
    assert.deepEqual(await me(uid), [])
    assert.equal((await db.query("select user_id from advisors where name = 'Mario'")).rows[0].user_id, null)
  })

  test('NO vincula a un asesor desactivado, ni a quien no está en el equipo', async () => {
    await db.query("insert into advisors (name, email, active) values ('Baja', 'baja@kreer.test', false)")
    assert.deepEqual(await me(await user(db, 'baja@kreer.test')), [])
    assert.deepEqual(await me(await user(db, 'extrano@kreer.test')), [])
  })

  test('un asesor ya vinculado a otro usuario no se puede reclamar', async () => {
    const dueno = await user(db, 'dueno@kreer.test')
    await addStaff(db, 'Dueña', 'duena@kreer.test', 'asesor', dueno)
    const intruso = await user(db, 'duena@kreer.test')
    assert.deepEqual(await me(intruso), [])
  })

  test('un admin legado agregado después recibe su fila al ingresar', async () => {
    const uid = await user(db, 'tardio@kreer.test')
    await db.query('insert into admins (user_id) values ($1)', [uid])
    await as(db, { uid }, async (q) => {
      const rows = (await q('select * from my_staff()')).rows
      assert.deepEqual(rows.map((r) => [r.name, r.role]), [['tardio', 'admin']])
    })
  })

  test('devuelve active=false para quien fue desactivado después de vincularse', async () => {
    const uid = await user(db, 'ex@kreer.test')
    await addStaff(db, 'Ex', 'ex@kreer.test', 'asesor', uid, false)
    assert.deepEqual((await me(uid)).map((r) => r.active), [false])
  })

  test('un visitante sin sesión no puede ejecutarla', async () => {
    await assert.rejects(as(db, { role: 'anon' }, (q) => q('select * from my_staff()')), /permission denied/)
  })
})

describe('003 · siempre queda un administrador', () => {
  let db, a1
  before(async () => {
    db = await newDb({ upTo: '003_roles.sql' })
    a1 = await user(db, 'a1@kreer.test')
    await addStaff(db, 'A1', 'a1@kreer.test', 'admin', a1)
  })

  test('no se puede quitar, desactivar ni borrar al único admin', async () => {
    await assert.rejects(db.query("update advisors set role = 'gerente' where name = 'A1'"), /al menos un administrador/)
    await assert.rejects(db.query("update advisors set active = false where name = 'A1'"), /al menos un administrador/)
    await assert.rejects(db.query("delete from advisors where name = 'A1'"), /al menos un administrador/)
  })

  test('con otro admin activo sí se puede', async () => {
    const a2 = await user(db, 'a2@kreer.test')
    await addStaff(db, 'A2', 'a2@kreer.test', 'admin', a2)
    await db.query("update advisors set role = 'gerente' where name = 'A1'")
    await assert.rejects(db.query("update advisors set role = 'gerente' where name = 'A2'"), /al menos un administrador/)
    await db.query("update advisors set role = 'admin' where name = 'A1'")
  })
})
