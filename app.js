const express = require('express');
const { engine } = require('express-handlebars');
const session = require('express-session');
const { generate } = require('randomstring');
const MemoryStore = require('memorystore')(session);
const { requireUser, getDataFromFile, writeDataToFile } = require('./utils.js');

const users = require('./user.json');

const port = 3000;
const app = express();

// Serving static image and css files
app.use(express.static(__dirname + '/public'));
app.set('trust proxy', 1);
app.set('view engine', 'hbs');

// Setting the view engine to be handlebars
// And setting the layouts and partials location
// for the render engine
app.engine(
  'hbs',
  engine({
    layoutsDir: `${__dirname}/views/layouts`,
    partialsDir: `${__dirname}/views/partials`,
    extname: 'hbs',
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Creating a session token and the secret
// is auto-generated using the randomstring npm module
app.use(
  session({
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
    secret: generate(),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true, sameSite: 'none' },
  })
);

app.get('/login', (req, res) => {
  return res.render('home', {
    title: 'Login',
    loginPage: true,
  });
});

app.get('/banking', requireUser, (req, res) => {
  const { username, account, limitFund } = req.session;
  if (account) {
    return res.render('home', {
      title: 'Banking',
      bankPage: true,
      username,
      gotNewAccount: true,
      accountNo: account.accountNo,
      accountType: account.accountType,
    });
  }

  if (limitFund) {
    return res.render('home', {
      title: 'Banking',
      bankPage: true,
      username,
      gotError: true,
      errorMessage: 'Insufficient Funds',
    });
  }

  return res.render('home', {
    title: 'Banking',
    bankPage: true,
    username,
  });
});

app.get('/balance/:account', requireUser, async (req, res) => {
  const { account } = req.params;
  const { data, isError, error } = await getDataFromFile('./accounts.json');

  if (isError) {
    console.error(`Error occurred: ${error}`);
    return res.sendStatus(500);
  }

  const selectedAccount = data[account];

  const accountType = selectedAccount?.accountType;
  const accountBalance = selectedAccount?.accountBalance;

  return res.render('home', {
    title: 'Balance',
    balancePage: true,
    accountNo: account,
    accountType,
    accountBalance,
  });
});

// The :account is a params object which can be used
// to pass data around in the URL
app.get('/deposit/:account', requireUser, (req, res) => {
  const { account } = req.params;
  return res.render('home', {
    title: 'Deposit',
    depositPage: true,
    accountNo: account,
  });
});

app.get('/account', requireUser, (req, res) => {
  return res.render('home', {
    title: 'Open Account',
    accountPage: true,
  });
});

app.get('/withdrawal/:account', requireUser, (req, res) => {
  const { account } = req.params;
  return res.render('home', {
    title: 'Withdrawal',
    withdrawalPage: true,
    accountNo: account,
  });
});

app.post('/login', (req, res) => {
  let error = new Error('');

  // Try catch block helps to catch
  // errors easily and deal with it
  try {
    const { username, password } = req.body;

    if (username === '' || password === '') {
      error.message = 'Enter both username and password';
      throw error;
    }

    // An array of the keys in the users object is extracted
    const isValidUser = Object.keys(users).includes(username);

    // An array of the values in the users object is extracted
    const isValidPassword = Object.values(users).includes(password);

    if (!isValidUser) {
      error.message = 'Not a registered username';
      throw error;
    }

    if (!isValidPassword) {
      error.message = 'Invalid password';
      throw error;
    }

    // username is added to session object
    // which will passed onto future HTTP requests
    req.session.username = username;
    req.session.save((err) => {
      if (err) console.info(`Error when saving session: ${err}`);
      return res.redirect('/banking');
    });
  } catch (err) {
    return res.render('home', {
      title: 'Login',
      loginPage: true,
      gotError: true,
      errorMessage: err.message,
    });
  }
});

app.post('/logout', (req, res) => {
  // On logout, the req.session is deleted
  // which tells the browser to delete the
  // cookie stored as the session token
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.sendStatus(500);
      } else {
        return res.redirect('/login');
      }
    });
  }
});

app.post('/banking', async (req, res) => {
  const { option, account } = req.body;

  const { isError, error, data } = await getDataFromFile('./accounts.json');

  if (isError) {
    console.error(`Error occurred: ${error}`);
    return res.sendStatus(500);
  }

  const isValidAccount = data[account];

  if (option !== 'account' && !isValidAccount) {
    return res.render('home', {
      title: 'Banking',
      bankPage: true,
      gotError: true,
      errorMessage: 'This account does not exist. Enter a valid account number',
    });
  }

  // Switch statements are worth it if
  // there are a lot of cases to be compared for
  switch (option) {
    case 'balance':
      return res.redirect(`/balance/${account}`);
    case 'deposit':
      return res.redirect(`/deposit/${account}`);
    case 'account':
      return res.redirect('/account');
    case 'withdrawal':
      return res.redirect(`/withdrawal/${account}`);
  }
});

app.post('/deposit', async (req, res) => {
  const { depositAmount, account } = req.body;

  const {
    isError: isReadError,
    error: readError,
    data,
  } = await getDataFromFile('./accounts.json');

  if (isReadError) {
    console.error(`Error occurred: ${readError}`);
    return res.sendStatus(500);
  }

  const { accountBalance } = data[account];
  const newAccountBalance = accountBalance + Number(depositAmount);

  data[account].accountBalance = newAccountBalance;

  const { isError: isWriteError, error: writeError } = await writeDataToFile(
    './accounts.json',
    data
  );

  if (isWriteError) {
    console.error(`Error occurred: ${writeError}`);
    return res.sendStatus(500);
  }

  return res.redirect('/banking');
});

app.post('/account', async (req, res) => {
  const { option } = req.body;
  const {
    isError: isReadError,
    error: readError,
    data,
  } = await getDataFromFile('./accounts.json');

  if (isReadError) {
    console.error(`Error occurred: ${readError}`);
    return res.sendStatus(500);
  }

  const { lastID } = data;
  const newID = Number(lastID) + 1;

  // This code will add 7 or less 0 before the newIDStr
  const newIDStr = String(newID).padStart(7, '0');

  data[newIDStr] = {
    accountType: option,
    accountBalance: 0,
  };

  data.lastID = newIDStr;

  const { isError: isWriteError, error: writeError } = await writeDataToFile(
    './accounts.json',
    data
  );

  if (isWriteError) {
    console.error(`Error occurred: ${writeError}`);
    return res.sendStatus(500);
  }
  req.session.account = {
    accountType: option,
    accountNo: newIDStr,
  };
  req.session.save((err) => {
    if (err) console.info(`Error when saving session: ${err}`);
  });
  return res.redirect('/banking');
});

app.post('/withdrawal', async (req, res) => {
  const { withdrawalAmount, account } = req.body;
  let isLimited = true;

  const {
    isError: isReadError,
    error: readError,
    data,
  } = await getDataFromFile('./accounts.json');

  if (isReadError) {
    console.error(`Error occurred: ${readError}`);
    return res.sendStatus(500);
  }
  const { accountBalance } = data[account];
  const newAccountBalance = accountBalance - Number(withdrawalAmount);

  if (newAccountBalance > 0) {
    isLimited = false;
    data[account].accountBalance = newAccountBalance;

    const { isError: isWriteError, error: writeError } = await writeDataToFile(
      './accounts.json',
      data
    );

    if (isWriteError) {
      console.error(`Error occurred: ${writeError}`);
      return res.sendStatus(500);
    }
  }

  req.session.limitFund = isLimited;
  req.session.save((err) => {
    if (err) console.info(`Error when saving session: ${err}`);
  });
  return res.redirect('/banking');
});

app.post('/cancel', (req, res) => {
  return res.redirect('/banking');
});

app.listen(port, () => {
  console.info(`Server started at http://localhost:${port}/login`);
});
