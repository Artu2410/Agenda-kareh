const DEFAULT_NOTE_TITLE = 'Nota sin titulo';

const normalizeNoteInput = (note = {}, index = 0) => {
  const title = String(note?.title || '').trim() || DEFAULT_NOTE_TITLE;
  const body = String(note?.body || '');
  const parsedUpdatedAt = note?.updatedAt ? new Date(note.updatedAt) : new Date();
  const updatedAt = Number.isNaN(parsedUpdatedAt.getTime()) ? new Date() : parsedUpdatedAt;

  return {
    id: String(note?.id || '').trim(),
    title,
    body,
    sortOrder: Number.isFinite(Number(note?.sortOrder)) ? Math.trunc(Number(note.sortOrder)) : index,
    updatedAt,
  };
};

const getOrderedNotes = async (prisma) => prisma.internalNote.findMany({
  orderBy: [
    { sortOrder: 'asc' },
    { updatedAt: 'desc' },
    { createdAt: 'asc' },
  ],
});

export const listNotes = async (req, res, prisma) => {
  try {
    const notes = await getOrderedNotes(prisma);
    return res.json(notes);
  } catch (error) {
    console.error('ERROR LISTANDO NOTAS:', error);
    return res.status(500).json({ message: 'No se pudieron cargar las notas.' });
  }
};

export const syncNotes = async (req, res, prisma) => {
  const inputNotes = Array.isArray(req.body?.notes) ? req.body.notes : null;

  if (!inputNotes) {
    return res.status(400).json({ message: 'Debes enviar un arreglo de notas.' });
  }

  const normalizedNotes = inputNotes
    .map((note, index) => normalizeNoteInput(note, index))
    .filter((note) => note.id);

  try {
    await prisma.$transaction(async (tx) => {
      for (const note of normalizedNotes) {
        await tx.internalNote.upsert({
          where: { id: note.id },
          update: {
            title: note.title,
            body: note.body,
            sortOrder: note.sortOrder,
            updatedAt: note.updatedAt,
          },
          create: {
            id: note.id,
            title: note.title,
            body: note.body,
            sortOrder: note.sortOrder,
            updatedAt: note.updatedAt,
          },
        });
      }

      if (normalizedNotes.length > 0) {
        await tx.internalNote.deleteMany({
          where: {
            id: {
              notIn: normalizedNotes.map((note) => note.id),
            },
          },
        });
      } else {
        await tx.internalNote.deleteMany();
      }
    });

    const notes = await getOrderedNotes(prisma);
    return res.json(notes);
  } catch (error) {
    console.error('ERROR SINCRONIZANDO NOTAS:', error);
    return res.status(500).json({ message: 'No se pudieron guardar las notas.' });
  }
};
