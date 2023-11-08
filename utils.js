const { readFile, writeFile } = require('fs').promises;
// Middleware to restrict webpage access
// to unauthenticated users
const requireUser = (req, res, next) => {
  const { username } = req.session;
  if (!username) res.sendStatus(403);

  next();
};

const getDataFromFile = async (filepath) => {
  try {
    const rawData = await readFile(filepath, 'utf-8');
    return { data: JSON.parse(rawData), error: null, isError: false };
  } catch (err) {
    return { data: null, isError: true, error: err };
  }
};

const writeDataToFile = async (filepath, data) => {
  try {
    await writeFile(filepath, JSON.stringify(data, null, 2));
    return { isError: false, error: null };
  } catch (err) {
    return { isError: true, error: err };
  }
};

module.exports = { requireUser, getDataFromFile, writeDataToFile };
