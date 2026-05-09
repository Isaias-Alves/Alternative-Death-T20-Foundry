// --- CONFIGURAÇÕES E UTILITÁRIOS ---

const MODULE_ID = "alternative-death-t20";

async function aplicarMoribundo(actor) {
  let vezesCaiu = actor.getFlag(MODULE_ID, "vezesMoribundoCena") || 0;
  await actor.setFlag(MODULE_ID, "vezesMoribundoCena", vezesCaiu + 1);

  const efeitoMoribundo = {
    label: "Moribundo",
    icon: "icons/svg/skull.svg",
    origin: actor.uuid,
    statuses: ["unconscious"],
    flags: { core: { overlay: true } },
  };
  return await actor.createEmbeddedDocuments("ActiveEffect", [efeitoMoribundo]);
}

// --- HOOKS ---

Hooks.on("preUpdateActor", (actor, update, options, userId) => {
  const hpPath = "system.attributes.pv.value";
  const novoHP = getProperty(update, hpPath);

  if (novoHP !== undefined && novoHP < 0) {
    update.system.attributes.pv.value = 0;

    const isMoribundo = actor.effects.some((e) => e.label === "Moribundo");
    if (!isMoribundo) {
      aplicarMoribundo(actor);
    }
  }
});

Hooks.on("updateActor", async (actor, update, options, userId) => {
  const novoPV = getProperty(update, "system.attributes.pv.value");
  if (novoPV > 0) {
    const efeito = actor.effects.find((e) => e.label === "Moribundo");
    if (efeito) {
      await efeito.delete();
      await actor.setFlag(MODULE_ID, "testesRealizados", 0);
    }
  }
});

Hooks.on("updateCombat", (combat, update, options, userId) => {
  if (!update.hasOwnProperty("turn") && !update.hasOwnProperty("round")) return;

  const actor = combat.combatant?.actor;
  if (!actor) return;

  const isMoribundo = actor.effects.some((e) => e.label === "Moribundo");
  if (isMoribundo) {
    realizarTesteConstituicaoMoribundo(actor);
  }
});

async function realizarTesteConstituicaoMoribundo(actor) {
  let vezesCaiu = actor.getFlag(MODULE_ID, "vezesMoribundoCena") || 0;
  let testesFeitos = actor.getFlag(MODULE_ID, "testesRealizados") || 0;
  let cdAtual = 10 + Math.max(0, vezesCaiu - 1) * 2 + testesFeitos * 2;

  let roll = await new Roll(
    `1d20 + @attributes.con.mod`,
    actor.getRollData(),
  ).evaluate({ async: true });

  await roll.toMessage({
    flavor: `<b>Teste de Moribundo (CD ${cdAtual})</b>`,
    speaker: ChatMessage.getSpeaker({ actor }),
  });

  await actor.setFlag(MODULE_ID, "testesRealizados", testesFeitos + 1);

  if (roll.total < cdAtual) {
    ui.notifications.warn(`${actor.name} falhou no teste de Moribundo!`);
    let lesoesAtuais =
      getProperty(actor, "system.resources.recurso1.value") || 0;
    await actor.update({ "system.resources.recurso1.value": lesoesAtuais + 1 });
  }
}

Hooks.on("renderActorSheet", (app, html, data) => {
  const recursoLesao = html.find('[name="system.resources.recurso1.value"]');
  if (recursoLesao.length) {
    recursoLesao.css({
      "background-color": "rgba(255, 0, 0, 0.2)",
      border: "1px solid red",
    });
    recursoLesao.attr("title", "Lesões (Regra Alternativa)");
  }
});

Hooks.on("applyActiveEffects", (actor) => {
  const numLesoes = getProperty(actor, "system.resources.recurso1.value") || 0;

  if (numLesoes > 0) {
    const penalidade = numLesoes * -2;
    actor.updateSource({
      "system.attributes.pericias.*.mod":
        (actor.system.attributes.pericias.*.mod || 0) + penalidade,
    });
  }
});
