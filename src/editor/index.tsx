import './css/app.css';
import './css/codemirror.css';
import './GraphQLEditor/editor.css';
import 'graphiql/graphiql.css';
import 'graphql-voyager/dist/voyager.css';

import { GraphQLSchema, Source } from 'graphql';
import * as GraphiQLPackage from 'graphiql';
import { Voyager } from 'graphql-voyager';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

// Cast GraphiQL to any to fix TypeScript errors
const GraphiQL = GraphiQLPackage.default as any;

import { buildWithFakeDefinitions } from '../fake_definition';
import GraphQLEditor from './GraphQLEditor/GraphQLEditor';
import { ConsoleIcon, EditIcon, GithubIcon, VoyagerIcon } from './icons';

interface FakeEditorState {
  value: string | null;
  cachedValue: string | null;
  activeTab: number;
  hasUnsavedChanges: boolean;
  error: string | null;
  status: string | null;
  schema: GraphQLSchema | null;
  unsavedSchema: GraphQLSchema | null;
  remoteSDL: string | null;
}

class FakeEditor extends React.Component<any, FakeEditorState> {
  constructor(props) {
    super(props);

    this.state = {
      value: null,
      cachedValue: null,
      activeTab: 0,
      hasUnsavedChanges: false,
      unsavedSchema: null,
      error: null,
      status: null,
      schema: null,
      remoteSDL: null,
    };
  }

  componentDidMount() {
    this.fetcher('/user-sdl')
      .then((response) => response.json())
      .then((SDLs) => {
        this.updateValue(SDLs);
      });

    window.onbeforeunload = () => {
      if (this.state.hasUnsavedChanges) return 'You have unsaved changes. Exit?';
    };
  }

  fetcher(url, options = {}) {
    const baseUrl = '..';
    return fetch(baseUrl + url, {
      credentials: 'include',
      ...options,
    });
  }

  graphQLFetcher(graphQLParams) {
    return this.fetcher('/graphql', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graphQLParams),
    }).then((response) => response.json());
  }

  updateValue({ userSDL, remoteSDL }) {
    this.setState({
      value: userSDL,
      cachedValue: userSDL,
      remoteSDL,
    });
    this.updateSDL(userSDL, true);
  }

  postSDL(sdl) {
    return this.fetcher('/user-sdl', {
      method: 'post',
      headers: { 'Content-Type': 'text/plain' },
      body: sdl,
    });
  }

  buildSchema(userSDL, options?) {
    if (this.state.remoteSDL) {
      return buildWithFakeDefinitions(
        new Source(this.state.remoteSDL),
        new Source(userSDL),
        options,
      );
    } else {
      return buildWithFakeDefinitions(new Source(userSDL), options);
    }
  }

  updateSDL(value, noError = false) {
    try {
      const schema = this.buildSchema(value);
      this.setState((prevState) => ({
        ...prevState,
        schema,
        error: null,
      }));
      return true;
    } catch (e) {
      if (noError) return;
      this.setState((prevState) => ({ ...prevState, error: e.message }));
      return false;
    }
  }

  setStatus(status, delay) {
    this.setState((prevState) => ({ ...prevState, status: status }));
    if (!delay) return;
    setTimeout(() => {
      this.setState((prevState) => ({ ...prevState, status: null }));
    }, delay);
  }

  saveUserSDL = () => {
    const { value, hasUnsavedChanges } = this.state;
    if (!hasUnsavedChanges) return;

    if (!this.updateSDL(value)) return;

    this.postSDL(value).then((res) => {
      if (res.ok) {
        this.setStatus('Saved!', 2000);
        return this.setState((prevState) => ({
          ...prevState,
          cachedValue: value,
          hasUnsavedChanges: false,
          unsavedSchema: null,
          error: null,
        }));
      } else {
        res.text().then((errorMessage) => {
          return this.setState((prevState) => ({
            ...prevState,
            error: errorMessage,
          }));
        });
      }
    });
  };

  switchTab(tab) {
    this.setState((prevState) => ({ ...prevState, activeTab: tab }));
  }

  onEdit = (val) => {
    if (this.state.error) this.updateSDL(val);
    let unsavedSchema = null as GraphQLSchema | null;
    try {
      unsavedSchema = this.buildSchema(val, { skipValidation: true });
    } catch (_) {
      // FIXME
    }

    this.setState((prevState) => ({
      ...prevState,
      value: val,
      hasUnsavedChanges: val !== this.state.cachedValue,
      unsavedSchema,
    }));
  };

  render() {
    const { value, activeTab, schema, hasUnsavedChanges, unsavedSchema } = this.state;
    if (value == null || schema == null) {
      return <div className="faker-editor-container">Loading...</div>;
    }

    return (
      <div className="faker-editor-container">
        <nav>
          <div className="logo">
            <a href="https://github.com/graphql-kit/graphql-faker" target="_blank" rel="noreferrer">
              {' '}
              <img src="./logo.svg" />{' '}
            </a>
          </div>
          <ul>
            <li
              onClick={() => this.switchTab(0)}
              className={`${activeTab === 0 ? '-active' : ''} ${
                hasUnsavedChanges ? '-unsaved' : ''
              }`}
            >
              {' '}
              <EditIcon />{' '}
            </li>
            <li
              onClick={() => !hasUnsavedChanges && this.switchTab(1)}
              className={`${activeTab === 1 ? '-active' : ''} ${
                hasUnsavedChanges ? '-unsaved' : ''
              }`}
            >
              {' '}
              <ConsoleIcon />{' '}
            </li>
            <li
              onClick={() => !hasUnsavedChanges && this.switchTab(2)}
              className={`${activeTab === 2 ? '-active' : ''} ${
                hasUnsavedChanges ? '-unsaved' : ''
              }`}
            >
              {' '}
              <VoyagerIcon />{' '}
            </li>
            <li className="-pulldown -link">
              <a
                href="https://github.com/graphql-kit/graphql-faker"
                target="_blank"
                rel="noreferrer"
              >
                {' '}
                <GithubIcon />{' '}
              </a>
            </li>
          </ul>
        </nav>
        <div className="tabs-container">
          <div className={`tab-content editor-container ${activeTab === 0 ? '-active' : ''}`}>
            <GraphQLEditor
              schema={unsavedSchema || schema}
              onEdit={this.onEdit}
              onCommand={this.saveUserSDL}
              value={value}
            />
            <div className="action-panel">
              <a
                className={`material-button ${hasUnsavedChanges ? '' : '-disabled'}`}
                onClick={this.saveUserSDL}
              >
                <span> Save </span>
              </a>
              <div className="status-bar">
                <span className="status"> {this.state.status} </span>
                <span className="error-message">{this.state.error}</span>
              </div>
            </div>
          </div>
          <div className={`tab-content ${activeTab === 1 ? '-active' : ''}`}>
            <GraphiQL fetcher={(e) => this.graphQLFetcher(e)} schema={schema} />
          </div>
          <div className={'tab-content ' + (activeTab === 2 ? '-active' : '')}>
            <Voyager
              introspection={(e) => this.graphQLFetcher({ query: e })}
              hideSettings={activeTab !== 2}
              workerURI="/voyager.worker.js"
            />
          </div>
        </div>
      </div>
    );
  }
}

ReactDOM.render(<FakeEditor />, document.getElementById('container'));
